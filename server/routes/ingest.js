import express from 'express'

import { requireAgentAuth } from '../middleware/agentMiddleware.js'
import User from '../models/User.js'
import Endpoint from '../models/Endpoint.js'
import Log from '../models/Log.js'
import Alert from '../models/Alert.js'
import AuditLog from '../models/AuditLog.js'
import AlertRule from '../models/AlertRule.js'
import { analyzeLogWithAI } from '../services/aiAnalyzer.js'
import { maybeAutoBlock } from '../services/ipBlocker.js'
import { sendThreatEmail } from '../services/emailService.js'
import { sendThreatWebhook } from '../services/webhookService.js'
import { lookupIpGeo } from '../services/geoService.js'
import { emitAlert, emitLog, emitThreatFeed } from '../socket/logStream.js'
import { queueIPEnrichment, updateIPStats } from '../services/ipIntelligence.js'
import { createNotification, shouldAlert, groupAlert } from '../services/notificationService.js'
import { evaluateRules } from '../routes/alertRules.js'

function severityRank(sev) {
  const s = String(sev || 'low').toLowerCase()
  return s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1
}

export default function ingestRoutes(io) {
  const router = express.Router()

  // POST /api/ingest/:endpointId
  router.post('/:endpointId', requireAgentAuth, async (req, res) => {
    try {
      const { endpointId } = req.params
      const agent = req.agent
      if (!agent || String(agent.endpointId) !== String(endpointId)) {
        return res.status(403).json({ error: 'Token endpointId mismatch' })
      }

      const endpoint = await Endpoint.findById(endpointId)
      if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' })

      const user = await User.findById(endpoint.userId)
      if (!user) return res.status(404).json({ error: 'User not found' })

      const batch = Array.isArray(req.body?.logs) ? req.body.logs : Array.isArray(req.body) ? req.body : null
      if (!batch) return res.status(400).json({ error: 'Expected logs array (either {logs:[...]} or [...] )' })

      endpoint.lastSeenAt = new Date()
      endpoint.status = 'online'
      await endpoint.save()

      // Load custom alert rules for this user (cached per request)
      let customRules = []
      try {
        customRules = await AlertRule.find({ userId: user._id, enabled: true }).lean()
      } catch { /* ignore */ }

      const processed = []

      for (const entry of batch) {
        const base = {
          ip: entry.ip || 'unknown',
          method: entry.method || 'GET',
          path: entry.path || entry.endpoint || entry.url || '/',
          statusCode: Number(entry.statusCode || entry.status || 200),
          userAgent: entry.userAgent || '',
          rawLog: entry.rawLog || JSON.stringify(entry),
          timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
        }

        const geo = await lookupIpGeo(base.ip)

        // AI analysis
        const ai = await analyzeLogWithAI({
          ...base,
          endpoint: { id: endpoint._id, name: endpoint.name, url: endpoint.url },
        })

        const isSuspicious = !!ai.isSuspicious
        const threatType = ai.threatType || null
        const severity = ai.severity || 'low'

        const log = await Log.create({
          endpointId: endpoint._id,
          userId: user._id,
          ...base,
          geo: geo || undefined,
          isSuspicious,
          threatType,
          aiAnalysis: {
            severity,
            reason: ai.reason,
            model: ai.model,
            raw: ai.raw,
          },
        })

        emitLog(io, endpoint._id.toString(), { log })

        // Queue IP enrichment (non-blocking)
        queueIPEnrichment(base.ip)
        updateIPStats(base.ip, { isSuspicious }).catch(() => {})

        // Emit to threat feed (real-time ticker)
        if (isSuspicious) {
          emitThreatFeed(io, {
            timestamp: base.timestamp,
            ip: base.ip,
            country: geo?.country || null,
            threatType,
            severity,
            endpointName: endpoint.name,
            path: base.path,
            blocked: false,
          })
        }

        let alertDoc = null
        let blocked = null

        if (isSuspicious && severityRank(severity) >= 2) {
          // Smart alert deduplication
          const shouldAlertNow = shouldAlert(base.ip, threatType)
          const alertGroup = groupAlert(base.ip, threatType)

          const message = alertGroup.grouped
            ? alertGroup.message
            : `${threatType || 'Threat'} detected from ${base.ip} targeting ${base.path}`

          alertDoc = await Alert.create({
            userId: user._id,
            endpointId: endpoint._id,
            logId: log._id,
            message,
            severity: ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium',
            sentAt: new Date(),
            read: false,
          })

          emitAlert(io, endpoint._id.toString(), { alert: alertDoc })

          // Create in-app notification (with deduplication)
          if (shouldAlertNow) {
            createNotification({
              userId: user._id,
              type: 'threat',
              title: `${threatType || 'Threat'} detected`,
              message: `${base.ip} attempted ${threatType || 'suspicious activity'} on ${endpoint.name}`,
              severity,
              link: `/dashboard/logs`,
              meta: { ip: base.ip, logId: String(log._id) },
            }).catch(() => {})
          }

          // Auto-block logic (5 suspicious in 10m default; configurable per endpoint)
          blocked = await maybeAutoBlock({ endpoint, user, ip: base.ip, now: new Date() })

          if (blocked?.blocked) {
            // Update threat feed with block status
            emitThreatFeed(io, {
              timestamp: new Date(),
              ip: base.ip,
              country: geo?.country || null,
              threatType: 'Auto-Blocked',
              severity: 'critical',
              endpointName: endpoint.name,
              path: base.path,
              blocked: true,
            })

            createNotification({
              userId: user._id,
              type: 'ip_blocked',
              title: `IP auto-blocked: ${base.ip}`,
              message: `${base.ip} was auto-blocked after ${blocked.suspiciousCount} suspicious events`,
              severity: 'high',
              link: `/dashboard/blocked-ips`,
            }).catch(() => {})
          }

          // Webhook (fire and forget)
          sendThreatWebhook({ endpoint, alert: alertDoc.toObject(), log: log.toObject() }).catch(() => {})

          // Email alerts (respect prefs + deduplication)
          const min = user.alertPrefs?.minSeverity || 'high'
          if (shouldAlertNow && user.alertPrefs?.emailEnabled !== false && severityRank(severity) >= severityRank(min)) {
            sendThreatEmail({
              to: user.email,
              endpointName: endpoint.name,
              ip: base.ip,
              threatType,
              severity,
              reason: ai.reason,
              log: log.toObject(),
            }).catch(() => {})
          }
        }

        // Evaluate custom alert rules
        if (customRules.length > 0) {
          const triggeredRules = evaluateRules(customRules, { ...base, ...log.toObject(), geo })
          for (const rule of triggeredRules) {
            // Update trigger count
            AlertRule.updateOne(
              { _id: rule._id },
              { $inc: { triggerCount: 1 }, $set: { lastTriggeredAt: new Date() } },
            ).catch(() => {})

            if (rule.action === 'block') {
              maybeAutoBlock({ endpoint, user, ip: base.ip, now: new Date() }).catch(() => {})
            }

            if (rule.action === 'alert' || rule.action === 'block') {
              createNotification({
                userId: user._id,
                type: 'rule_triggered',
                title: `Rule "${rule.name}" triggered`,
                message: `${base.ip} matched rule conditions on ${endpoint.name}`,
                severity: rule.severity,
                link: `/dashboard/logs`,
                meta: { ruleId: String(rule._id), ip: base.ip },
              }).catch(() => {})
            }
          }
        }

        processed.push({
          id: log._id,
          isSuspicious,
          threatType,
          severity,
          blocked: blocked?.blocked || false,
        })
      }

      await AuditLog.create({
        userId: user._id,
        endpointId: endpoint._id,
        actorClerkId: null,
        action: 'agent.ingest',
        meta: { count: processed.length },
      })

      res.json({ ok: true, processed: processed.length, results: processed })
    } catch (err) {
      console.error('ingest error:', err)
      res.status(500).json({ error: 'Failed to ingest logs' })
    }
  })

  return router
}

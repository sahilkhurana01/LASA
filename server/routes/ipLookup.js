import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Log from '../models/Log.js'
import Endpoint from '../models/Endpoint.js'
import BlockedIP from '../models/BlockedIP.js'
import IPIntelligence from '../models/IPIntelligence.js'
import AuditLog from '../models/AuditLog.js'
import { enrichIP, batchEnrichIPs, isPrivateIP } from '../services/ipIntelligence.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/ip/lookup/:ip — Look up single IP
router.get('/lookup/:ip', requireDashboardAuth, async (req, res) => {
  try {
    const { ip } = req.params
    if (!ip) return res.status(400).json({ error: 'IP address required' })

    const result = await enrichIP(ip)
    if (!result) return res.status(404).json({ error: 'Could not look up IP' })

    res.json({ ip: result })
  } catch (err) {
    res.status(500).json({ error: err.message || 'IP lookup failed' })
  }
})

// POST /api/ip/lookup/batch — Bulk lookup
router.post('/lookup/batch', requireDashboardAuth, async (req, res) => {
  try {
    const { ips } = req.body || {}
    if (!Array.isArray(ips) || ips.length === 0) return res.status(400).json({ error: 'ips array required' })
    if (ips.length > 50) return res.status(400).json({ error: 'Max 50 IPs per batch' })

    const results = await batchEnrichIPs(ips)
    res.json({ results })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Batch lookup failed' })
  }
})

// GET /api/ip/top-attackers — Top 20 attacking IPs for user
router.get('/top-attackers', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const topIPs = await Log.aggregate([
      { $match: { userId: user._id, isSuspicious: true, timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$ip',
          attackCount: { $sum: 1 },
          threatTypes: { $addToSet: '$threatType' },
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' },
        },
      },
      { $sort: { attackCount: -1 } },
      { $limit: 20 },
    ])

    // Enrich with IP intelligence
    const enriched = []
    for (const ipData of topIPs) {
      const intel = await IPIntelligence.findOne({ ip: ipData._id }).lean()
      const isBlocked = await BlockedIP.exists({ userId: user._id, ip: ipData._id })
      enriched.push({
        ip: ipData._id,
        attackCount: ipData.attackCount,
        threatTypes: ipData.threatTypes.filter(Boolean),
        firstSeen: ipData.firstSeen,
        lastSeen: ipData.lastSeen,
        country: intel?.country || null,
        countryCode: intel?.countryCode || null,
        isp: intel?.isp || null,
        abuseScore: intel?.abuseScore || 0,
        lasaRiskScore: intel?.lasaRiskScore || 0,
        lasaRiskLevel: intel?.lasaRiskLevel || 'clean',
        isBlocked: !!isBlocked,
      })
    }

    res.json({ attackers: enriched })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get top attackers' })
  }
})

// GET /api/ip/threat-map — Aggregated attack origins for world map
router.get('/threat-map', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get IPs grouped by country from IP intelligence
    const threateningIPs = await Log.aggregate([
      { $match: { userId: user._id, isSuspicious: true, timestamp: { $gte: since } } },
      { $group: { _id: '$ip', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
    ])

    const ipList = threateningIPs.map((t) => t._id)
    const countMap = Object.fromEntries(threateningIPs.map((t) => [t._id, t.count]))

    const intels = await IPIntelligence.find({ ip: { $in: ipList } }).lean()

    // Group by country
    const countryMap = {}
    for (const intel of intels) {
      if (!intel.country || !intel.countryCode) continue
      const key = intel.countryCode
      if (!countryMap[key]) {
        countryMap[key] = {
          country: intel.country,
          countryCode: intel.countryCode,
          lat: intel.lat || 0,
          lon: intel.lon || 0,
          attackCount: 0,
          ips: [],
        }
      }
      countryMap[key].attackCount += countMap[intel.ip] || 0
      if (countryMap[key].ips.length < 5) countryMap[key].ips.push(intel.ip)
    }

    const mapData = Object.values(countryMap).sort((a, b) => b.attackCount - a.attackCount)
    res.json({ mapData })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get threat map data' })
  }
})

// GET /api/ip/:ip/history — All logs from this IP for this user
router.get('/:ip/history', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { ip } = req.params
    const { limit = 50, page = 1 } = req.query

    const skip = (Number(page) - 1) * Number(limit)
    const [logs, total] = await Promise.all([
      Log.find({ userId: user._id, ip }).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).lean(),
      Log.countDocuments({ userId: user._id, ip }),
    ])

    // Enrich log with endpoint name
    const endpointIds = [...new Set(logs.map((l) => String(l.endpointId)))]
    const endpoints = await Endpoint.find({ _id: { $in: endpointIds } }).select('_id name').lean()
    const epMap = Object.fromEntries(endpoints.map((e) => [String(e._id), e.name]))
    const enriched = logs.map((l) => ({ ...l, endpointName: epMap[String(l.endpointId)] || 'Unknown' }))

    res.json({
      logs: enriched,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get IP history' })
  }
})

// POST /api/ip/:ip/block — Manually block IP across all user endpoints
router.post('/:ip/block', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { ip } = req.params
    const { reason = 'Manually blocked from IP Intelligence' } = req.body || {}

    const endpoints = await Endpoint.find({ userId: user._id }).select('_id').lean()
    const blocked = []

    for (const ep of endpoints) {
      const doc = await BlockedIP.findOneAndUpdate(
        { userId: user._id, endpointId: ep._id, ip },
        {
          userId: user._id,
          endpointId: ep._id,
          ip,
          reason,
          blockedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          severity: 'high',
        },
        { upsert: true, new: true },
      )
      blocked.push(doc)
    }

    // Update IP intelligence
    await IPIntelligence.updateOne({ ip }, { $set: { isBlockedByUser: true } }, { upsert: true })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'ip.block',
      meta: { ip, reason, endpoints: blocked.length },
    })

    res.json({ ok: true, blocked: blocked.length })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to block IP' })
  }
})

// DELETE /api/ip/:ip/block — Unblock IP across all user endpoints
router.delete('/:ip/block', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { ip } = req.params

    const result = await BlockedIP.deleteMany({ userId: user._id, ip })
    await IPIntelligence.updateOne({ ip }, { $set: { isBlockedByUser: false } })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'ip.unblock',
      meta: { ip, deleted: result.deletedCount },
    })

    res.json({ ok: true, deleted: result.deletedCount })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to unblock IP' })
  }
})

// POST /api/ip/:ip/whitelist — Mark IP as whitelisted (false-positive safe)
router.post('/:ip/whitelist', requireDashboardAuth, async (req, res) => {
  try {
    await IPIntelligence.updateOne(
      { ip: req.params.ip },
      { $set: { isWhitelisted: true, lasaRiskScore: 0, lasaRiskLevel: 'clean' } },
      { upsert: true },
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to whitelist IP' })
  }
})

// DELETE /api/ip/:ip/whitelist — Remove from whitelist
router.delete('/:ip/whitelist', requireDashboardAuth, async (req, res) => {
  try {
    await IPIntelligence.updateOne(
      { ip: req.params.ip },
      { $set: { isWhitelisted: false } },
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to remove from whitelist' })
  }
})

// POST /api/ip/:ip/false-positive — Mark as false positive
router.post('/:ip/false-positive', requireDashboardAuth, async (req, res) => {
  try {
    const result = await IPIntelligence.findOneAndUpdate(
      { ip: req.params.ip },
      { $inc: { falsePositiveCount: 1 } },
      { upsert: true, new: true },
    )

    // If 3+ false positives, lower risk score
    if (result.falsePositiveCount >= 3) {
      const newScore = Math.max(0, (result.lasaRiskScore || 0) - 20)
      const newLevel = newScore > 75 ? 'critical' : newScore > 50 ? 'malicious' : newScore > 25 ? 'suspicious' : 'clean'
      await IPIntelligence.updateOne(
        { ip: req.params.ip },
        { $set: { lasaRiskScore: newScore, lasaRiskLevel: newLevel } },
      )
    }

    res.json({ ok: true, falsePositiveCount: result.falsePositiveCount })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark false positive' })
  }
})

export default router

import BlockedIP from '../models/BlockedIP.js'
import Log from '../models/Log.js'

function severityRank(sev) {
  const s = String(sev || 'low').toLowerCase()
  return s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1
}

export async function maybeAutoBlock({ endpoint, user, ip, now = new Date() }) {
  const rule = endpoint.rateLimitRule || {}
  const enabled = rule.enabled !== false
  if (!enabled) return { blocked: false, reason: 'disabled' }

  const windowMinutes = Number(rule.windowMinutes || 10)
  const blockAfter = Number(rule.blockAfter || 3)

  const since = new Date(now.getTime() - windowMinutes * 60 * 1000)

  const suspiciousCount = await Log.countDocuments({
    endpointId: endpoint._id,
    userId: user._id,
    ip,
    isSuspicious: true,
    timestamp: { $gte: since },
  })

  if (suspiciousCount < blockAfter) return { blocked: false, reason: 'threshold-not-met', suspiciousCount }

  const existing = await BlockedIP.findOne({ endpointId: endpoint._id, userId: user._id, ip }).lean()
  if (existing) return { blocked: false, reason: 'already-blocked' }

  const severityThreshold = rule.severityThreshold || 'medium'
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // default 24h

  await BlockedIP.create({
    endpointId: endpoint._id,
    userId: user._id,
    ip,
    reason: `Auto-blocked after ${suspiciousCount} suspicious events in ${windowMinutes}m`,
    blockedAt: now,
    expiresAt,
    severity: severityThreshold,
  })

  return { blocked: true, reason: 'auto-block', suspiciousCount, expiresAt, severityRank: severityRank(severityThreshold) }
}


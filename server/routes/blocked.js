import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Endpoint from '../models/Endpoint.js'
import BlockedIP from '../models/BlockedIP.js'
import AuditLog from '../models/AuditLog.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/blocked
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { endpointId } = req.query
    const filter = { userId: user._id }
    if (endpointId) filter.endpointId = endpointId
    const blocked = await BlockedIP.find(filter).sort({ blockedAt: -1 }).limit(5000).lean()

    const endpointIds = Array.from(new Set(blocked.map((b) => String(b.endpointId))))
    const endpoints = await Endpoint.find({ _id: { $in: endpointIds }, userId: user._id }).select('_id name').lean()
    const map = Object.fromEntries(endpoints.map((e) => [String(e._id), e.name]))
    const enriched = blocked.map((b) => ({ ...b, endpointName: map[String(b.endpointId)] || 'Unknown' }))

    res.json({ blocked: enriched })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to fetch blocked IPs' })
  }
})

// POST /api/blocked
router.post('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { endpointId, ip, reason, durationMinutes = 60, severity = 'medium' } = req.body || {}
    if (!endpointId || !ip) return res.status(400).json({ error: 'endpointId and ip are required' })

    const endpoint = await Endpoint.findOne({ _id: endpointId, userId: user._id })
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' })

    const expiresAt = durationMinutes ? new Date(Date.now() + Number(durationMinutes) * 60 * 1000) : null

    const blocked = await BlockedIP.findOneAndUpdate(
      { userId: user._id, endpointId, ip },
      { userId: user._id, endpointId, ip, reason: reason || 'Manual block', blockedAt: new Date(), expiresAt, severity },
      { upsert: true, new: true },
    )

    await AuditLog.create({
      userId: user._id,
      endpointId,
      actorClerkId: user.clerkId,
      action: 'blocked.create',
      meta: { ip, reason, durationMinutes, severity },
    })

    res.status(201).json({ blocked })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to block IP' })
  }
})

// DELETE /api/blocked/:id
router.delete('/:id', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const b = await BlockedIP.findOneAndDelete({ _id: req.params.id, userId: user._id })
    if (!b) return res.status(404).json({ error: 'Blocked entry not found' })

    await AuditLog.create({
      userId: user._id,
      endpointId: b.endpointId,
      actorClerkId: user.clerkId,
      action: 'blocked.delete',
      meta: { ip: b.ip },
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to unblock IP' })
  }
})

// POST /api/blocked/bulk-delete
router.post('/bulk-delete', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { ids } = req.body || {}
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' })

    const result = await BlockedIP.deleteMany({ _id: { $in: ids }, userId: user._id })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'blocked.bulkDelete',
      meta: { count: result.deletedCount },
    })

    res.json({ ok: true, deleted: result.deletedCount })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed bulk unblock' })
  }
})

export default router


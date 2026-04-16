import express from 'express'
import jwt from 'jsonwebtoken'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Endpoint from '../models/Endpoint.js'
import Log from '../models/Log.js'
import AuditLog from '../models/AuditLog.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

function signAgentToken({ endpointId, userId }) {
  const secret = process.env.JWT_SECRET || ''
  return jwt.sign({ endpointId, userId }, secret, { expiresIn: '365d' })
}

// GET /api/endpoints
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const endpoints = await Endpoint.find({ userId: user._id }).sort({ createdAt: -1 }).lean()

    // Compute logs/threats today + online status (lastSeenAt within 5m)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const now = new Date()
    const onlineCutoff = new Date(now.getTime() - 5 * 60 * 1000)

    const stats = await Log.aggregate([
      { $match: { userId: user._id, timestamp: { $gte: start } } },
      {
        $group: {
          _id: '$endpointId',
          logsToday: { $sum: 1 },
          threatsToday: { $sum: { $cond: ['$isSuspicious', 1, 0] } },
          lastSeenAt: { $max: '$timestamp' },
        },
      },
    ])

    const map = new Map(stats.map((s) => [String(s._id), s]))
    const enriched = endpoints.map((e) => {
      const s = map.get(String(e._id))
      const last = s?.lastSeenAt || e.lastSeenAt
      const online = last && new Date(last) >= onlineCutoff
      return {
        ...e,
        status: online ? 'online' : 'offline',
        logsToday: s?.logsToday || 0,
        threatsToday: s?.threatsToday || 0,
        lastSeenAt: last || null,
      }
    })

    res.json({ endpoints: enriched })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to load endpoints' })
  }
})

// POST /api/endpoints
router.post('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { name, url } = req.body || {}
    if (!name || !url) return res.status(400).json({ error: 'name and url are required' })

    const endpoint = await Endpoint.create({
      userId: user._id,
      name,
      url,
      agentToken: 'pending',
      status: 'offline',
    })

    const agentToken = signAgentToken({ endpointId: endpoint._id.toString(), userId: user._id.toString() })
    endpoint.agentToken = agentToken
    await endpoint.save()

    await AuditLog.create({
      userId: user._id,
      endpointId: endpoint._id,
      actorClerkId: user.clerkId,
      action: 'endpoint.create',
      meta: { name, url },
    })

    res.status(201).json({ endpoint })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create endpoint' })
  }
})

// PATCH /api/endpoints/:id
router.patch('/:id', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { id } = req.params
    const update = {}
    if (req.body?.name) update.name = req.body.name
    if (req.body?.url) update.url = req.body.url
    if (req.body?.webhookUrl !== undefined) update.webhookUrl = req.body.webhookUrl || null
    if (req.body?.rateLimitRule) update.rateLimitRule = req.body.rateLimitRule

    const endpoint = await Endpoint.findOneAndUpdate({ _id: id, userId: user._id }, update, { new: true })
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' })

    await AuditLog.create({
      userId: user._id,
      endpointId: endpoint._id,
      actorClerkId: user.clerkId,
      action: 'endpoint.update',
      meta: { update },
    })

    res.json({ endpoint })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update endpoint' })
  }
})

// POST /api/endpoints/:id/regenerate-token
router.post('/:id/regenerate-token', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { id } = req.params
    const endpoint = await Endpoint.findOne({ _id: id, userId: user._id })
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' })

    endpoint.agentToken = signAgentToken({ endpointId: endpoint._id.toString(), userId: user._id.toString() })
    await endpoint.save()

    await AuditLog.create({
      userId: user._id,
      endpointId: endpoint._id,
      actorClerkId: user.clerkId,
      action: 'endpoint.regenerateToken',
      meta: {},
    })

    res.json({ endpoint })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to regenerate token' })
  }
})

// DELETE /api/endpoints/:id
router.delete('/:id', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { id } = req.params
    const endpoint = await Endpoint.findOneAndDelete({ _id: id, userId: user._id })
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' })

    await Log.deleteMany({ endpointId: endpoint._id, userId: user._id })

    await AuditLog.create({
      userId: user._id,
      endpointId: endpoint._id,
      actorClerkId: user.clerkId,
      action: 'endpoint.delete',
      meta: { name: endpoint.name, url: endpoint.url },
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete endpoint' })
  }
})

export default router


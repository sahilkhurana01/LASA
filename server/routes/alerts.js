import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Alert from '../models/Alert.js'
import Endpoint from '../models/Endpoint.js'
import AuditLog from '../models/AuditLog.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/alerts
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { severity, read, page = 1, limit = 50 } = req.query

    const filter = { userId: user._id }
    if (severity && severity !== 'all') filter.severity = severity
    if (read === 'true') filter.read = true
    if (read === 'false') filter.read = false

    const skip = (Number(page) - 1) * Number(limit)
    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ sentAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Alert.countDocuments(filter),
    ])

    const endpointIds = Array.from(new Set(alerts.map((a) => String(a.endpointId))))
    const endpoints = await Endpoint.find({ _id: { $in: endpointIds }, userId: user._id }).select('_id name').lean()
    const map = Object.fromEntries(endpoints.map((e) => [String(e._id), e.name]))
    const enriched = alerts.map((a) => ({ ...a, endpointName: map[String(a.endpointId)] || 'Unknown' }))

    res.json({
      alerts: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to fetch alerts' })
  }
})

// POST /api/alerts/mark-read
router.post('/mark-read', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { ids } = req.body || {}
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' })
    await Alert.updateMany({ _id: { $in: ids }, userId: user._id }, { $set: { read: true } })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'alerts.markRead',
      meta: { count: ids.length },
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark as read' })
  }
})

// POST /api/alerts/mark-all-read
router.post('/mark-all-read', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const r = await Alert.updateMany({ userId: user._id, read: false }, { $set: { read: true } })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'alerts.markAllRead',
      meta: { modified: r.modifiedCount },
    })

    res.json({ ok: true, modified: r.modifiedCount })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark all as read' })
  }
})

// GET /api/alerts/unread-count
router.get('/unread-count', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const count = await Alert.countDocuments({ userId: user._id, read: false })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

// GET /api/alerts/export.csv
router.get('/export.csv', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const alerts = await Alert.find({ userId: user._id }).sort({ sentAt: -1 }).limit(50_000).lean()
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="lasa-alerts.csv"')
    const header = ['sentAt', 'endpointId', 'severity', 'message', 'read', 'logId']
    res.write(header.join(',') + '\n')
    for (const a of alerts) {
      const row = [
        new Date(a.sentAt).toISOString(),
        String(a.endpointId),
        String(a.severity),
        JSON.stringify(String(a.message)).slice(1, -1),
        String(!!a.read),
        String(a.logId),
      ]
      res.write(row.join(',') + '\n')
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to export' })
  }
})

export default router


import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/notifications — Get notifications (paginated)
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { limit = 20, unreadOnly } = req.query

    const filter = { userId: user._id }
    if (unreadOnly === 'true') filter.read = false

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean()

    const unreadCount = await Notification.countDocuments({ userId: user._id, read: false })

    res.json({ notifications, unreadCount })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch notifications' })
  }
})

// GET /api/notifications/unread-count — Quick count
router.get('/unread-count', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const count = await Notification.countDocuments({ userId: user._id, read: false })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

// POST /api/notifications/mark-read — Mark specific notifications as read
router.post('/mark-read', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { ids } = req.body || {}
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' })
    await Notification.updateMany({ _id: { $in: ids }, userId: user._id }, { $set: { read: true } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

// POST /api/notifications/mark-all-read — Mark all as read
router.post('/mark-all-read', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    await Notification.updateMany({ userId: user._id, read: false }, { $set: { read: true } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

export default router

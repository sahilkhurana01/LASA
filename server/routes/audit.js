import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/audit
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { page = 1, limit = 50, action } = req.query
    const filter = { userId: user._id }
    if (action) filter.action = action

    const skip = (Number(page) - 1) * Number(limit)
    const [events, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(filter),
    ])

    res.json({
      events,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to fetch audit log' })
  }
})

export default router


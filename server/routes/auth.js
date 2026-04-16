import express from 'express'

import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import { clerkClient } from '../lib/clerk.js'

const router = express.Router()

// POST /api/auth/sync
// Syncs Clerk user -> Mongo user
router.post('/sync', requireDashboardAuth, async (req, res) => {
  try {
    const userId = req.auth.userId
    const clerkUser = await clerkClient.users.getUser(userId)
    const email = clerkUser?.primaryEmailAddress?.emailAddress
    if (!email) return res.status(400).json({ error: 'Clerk user missing email' })

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      { clerkId: userId, email },
      { upsert: true, new: true },
    )

    await AuditLog.create({
      userId: user._id,
      actorClerkId: userId,
      action: 'auth.sync',
      meta: { email },
    })

    res.json({
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        plan: user.plan,
        alertPrefs: user.alertPrefs,
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    console.error('auth/sync error:', err)
    res.status(500).json({ error: 'Failed to sync user' })
  }
})

export default router


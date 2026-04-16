import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import Endpoint from '../models/Endpoint.js'
import Log from '../models/Log.js'
import Alert from '../models/Alert.js'
import BlockedIP from '../models/BlockedIP.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/user/me
router.get('/me', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
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
    res.status(400).json({ error: err.message || 'Failed' })
  }
})

// PATCH /api/user/prefs
router.patch('/prefs', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const next = req.body?.alertPrefs
    if (!next) return res.status(400).json({ error: 'alertPrefs required' })

    const emailEnabled = next.emailEnabled !== false
    const minSeverity = ['low', 'medium', 'high', 'critical'].includes(next.minSeverity) ? next.minSeverity : 'high'

    user.alertPrefs = { emailEnabled, minSeverity }
    await user.save()

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'user.updatePrefs',
      meta: { alertPrefs: user.alertPrefs },
    })

    res.json({ user: { id: user._id, alertPrefs: user.alertPrefs } })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update prefs' })
  }
})

// POST /api/user/clear
// Clears logs, alerts, blocked IPs, audit (keeps endpoints + user)
router.post('/clear', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const [logs, alerts, blocked, audit] = await Promise.all([
      Log.deleteMany({ userId: user._id }),
      Alert.deleteMany({ userId: user._id }),
      BlockedIP.deleteMany({ userId: user._id }),
      AuditLog.deleteMany({ userId: user._id }),
    ])

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'user.clearData',
      meta: { logs: logs.deletedCount, alerts: alerts.deletedCount, blocked: blocked.deletedCount, audit: audit.deletedCount },
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to clear data' })
  }
})

// DELETE /api/user/account
// Deletes user and all data (keeps Clerk account intact; you should delete in Clerk separately if desired)
router.delete('/account', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const endpoints = await Endpoint.find({ userId: user._id }).select('_id').lean()
    const endpointIds = endpoints.map((e) => e._id)

    await Promise.all([
      Log.deleteMany({ userId: user._id }),
      Alert.deleteMany({ userId: user._id }),
      BlockedIP.deleteMany({ userId: user._id }),
      AuditLog.deleteMany({ userId: user._id }),
      Endpoint.deleteMany({ userId: user._id }),
    ])

    await User.deleteOne({ _id: user._id })

    res.json({ ok: true, deletedEndpoints: endpointIds.length })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete account' })
  }
})

export default router


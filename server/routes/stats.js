import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Endpoint from '../models/Endpoint.js'
import Log from '../models/Log.js'
import BlockedIP from '../models/BlockedIP.js'
import Alert from '../models/Alert.js'
import AuditLog from '../models/AuditLog.js'
import { analyzeLogWithAI } from '../services/aiAnalyzer.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/stats
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const now = new Date()
    const onlineCutoff = new Date(now.getTime() - 5 * 60 * 1000)

    const [totalLogsToday, threatsToday, blockedIps, endpoints, unreadAlerts] = await Promise.all([
      Log.countDocuments({ userId: user._id, timestamp: { $gte: start } }),
      Log.countDocuments({ userId: user._id, timestamp: { $gte: start }, isSuspicious: true }),
      BlockedIP.countDocuments({ userId: user._id }),
      Endpoint.find({ userId: user._id }).lean(),
      Alert.countDocuments({ userId: user._id, read: false }),
    ])

    const activeEndpoints = endpoints.filter((e) => e.lastSeenAt && new Date(e.lastSeenAt) >= onlineCutoff).length

    // 24h chart (hour buckets)
    const since24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const hourly = await Log.aggregate([
      { $match: { userId: user._id, timestamp: { $gte: since24 } } },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          total: { $sum: 1 },
          suspicious: { $sum: { $cond: ['$isSuspicious', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ])
    const hourMap = Object.fromEntries(hourly.map((h) => [h._id, h]))
    const hourly24 = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      total: hourMap[i]?.total ?? 0,
      suspicious: hourMap[i]?.suspicious ?? 0,
    }))

    const threatsByType = await Log.aggregate([
      { $match: { userId: user._id, timestamp: { $gte: since24 }, threatType: { $ne: null } } },
      { $group: { _id: '$threatType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ])

    // Heatmap: last 7 days x 24h (GitHub-style)
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const heat = await Log.aggregate([
      { $match: { userId: user._id, timestamp: { $gte: since7 }, isSuspicious: true } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            hour: { $hour: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1, '_id.hour': 1 } },
    ])

    // Geo analytics (country)
    const geo = await Log.aggregate([
      { $match: { userId: user._id, timestamp: { $gte: since24 }, isSuspicious: true, 'geo.country': { $ne: null } } },
      { $group: { _id: '$geo.country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ])

    // AI Threat Summary (daily)
    const topThreats = threatsByType.slice(0, 5).map((t) => `${t._id}(${t.count})`).join(', ')
    const summary = await analyzeLogWithAI({
      summaryRequest: true,
      window: '24h',
      totals: { totalLogsToday, threatsToday, blockedIps, activeEndpoints },
      topThreats,
    })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'stats.view',
      meta: {},
    })

    res.json({
      cards: { totalLogsToday, threatsToday, blockedIps, activeEndpoints, unreadAlerts },
      charts: { hourly24, threatsByType },
      heatmap: heat,
      geo,
      aiSummary: summary?.reason || summary?.raw?.reason || summary?.raw || null,
    })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to fetch stats' })
  }
})

export default router


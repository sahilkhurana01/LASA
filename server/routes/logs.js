import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Log from '../models/Log.js'
import Endpoint from '../models/Endpoint.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/logs
// Filters: endpointId, severity, threatType, ip, method, q (full text), from/to, suspiciousOnly
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const {
      endpointId,
      severity,
      threatType,
      ip,
      method,
      q,
      from,
      to,
      suspiciousOnly,
      page = 1,
      limit = 50,
    } = req.query

    const filter = { userId: user._id }
    if (endpointId) filter.endpointId = endpointId
    if (ip) filter.ip = ip
    if (method) filter.method = String(method).toUpperCase()
    if (threatType) filter.threatType = threatType
    if (severity) filter['aiAnalysis.severity'] = severity
    if (suspiciousOnly === 'true') filter.isSuspicious = true
    if (from || to) {
      filter.timestamp = {}
      if (from) filter.timestamp.$gte = new Date(from)
      if (to) filter.timestamp.$lte = new Date(to)
    }

    const skip = (Number(page) - 1) * Number(limit)

    const textQuery = q ? { $text: { $search: String(q) } } : null
    const finalFilter = textQuery ? { $and: [filter, textQuery] } : filter

    const [logs, total] = await Promise.all([
      Log.find(finalFilter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Log.countDocuments(finalFilter),
    ])

    // Attach endpoint names for convenience
    const endpointIds = Array.from(new Set(logs.map((l) => String(l.endpointId))))
    const endpoints = await Endpoint.find({ _id: { $in: endpointIds }, userId: user._id }).select('_id name').lean()
    const map = Object.fromEntries(endpoints.map((e) => [String(e._id), e.name]))

    const enriched = logs.map((l) => ({ ...l, endpointName: map[String(l.endpointId)] || 'Unknown' }))

    res.json({
      logs: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to fetch logs' })
  }
})

// GET /api/logs/export.csv
router.get('/export.csv', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { endpointId, from, to, suspiciousOnly } = req.query
    const filter = { userId: user._id }
    if (endpointId) filter.endpointId = endpointId
    if (suspiciousOnly === 'true') filter.isSuspicious = true
    if (from || to) {
      filter.timestamp = {}
      if (from) filter.timestamp.$gte = new Date(from)
      if (to) filter.timestamp.$lte = new Date(to)
    }

    const logs = await Log.find(filter).sort({ timestamp: -1 }).limit(50_000).lean()

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="lasa-logs.csv"')

    const header = ['timestamp', 'endpointId', 'ip', 'method', 'path', 'statusCode', 'isSuspicious', 'threatType', 'severity', 'reason']
    res.write(header.join(',') + '\n')
    for (const l of logs) {
      const row = [
        new Date(l.timestamp).toISOString(),
        String(l.endpointId),
        String(l.ip || ''),
        String(l.method || ''),
        JSON.stringify(String(l.path || '')).slice(1, -1),
        String(l.statusCode ?? ''),
        String(!!l.isSuspicious),
        String(l.threatType ?? ''),
        String(l.aiAnalysis?.severity ?? ''),
        JSON.stringify(String(l.aiAnalysis?.reason ?? '')).slice(1, -1),
      ]
      res.write(row.join(',') + '\n')
    }
    res.end()
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to export' })
  }
})

export default router


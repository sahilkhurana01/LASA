import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import AuditLog from '../models/AuditLog.js'
import { generateReport, sendReportEmail } from '../services/reportGenerator.js'

const router = express.Router()

let ioRef = null

export function setReportsIO(io) {
  ioRef = io
}

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/reports — Get all reports for user (paginated)
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { page = 1, limit = 20, period } = req.query

    const filter = { userId: String(user._id) }
    if (period) filter.period = period

    const skip = (Number(page) - 1) * Number(limit)
    const [reports, total] = await Promise.all([
      Report.find(filter)
        .select('-htmlContent -rawStats') // Exclude heavy fields from list
        .sort({ generatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Report.countDocuments(filter),
    ])

    res.json({
      reports,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch reports' })
  }
})

// GET /api/reports/latest — Get the most recent completed report
router.get('/latest', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const report = await Report.findOne({ userId: String(user._id), status: 'completed' })
      .select('-htmlContent -rawStats')
      .sort({ generatedAt: -1 })
      .lean()

    res.json({ report: report || null })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch latest report' })
  }
})

// GET /api/reports/:id — Get single report with full content
router.get('/:id', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const report = await Report.findOne({ _id: req.params.id, userId: String(user._id) }).lean()
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json({ report })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch report' })
  }
})

// POST /api/reports/generate — Manually trigger report generation (async)
router.post('/generate', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { period = 'manual' } = req.body || {}

    // Create initial report doc
    const report = { _id: null, status: 'generating' }

    // Start generation in background
    generateReport(user._id, period, ioRef)
      .then(async (r) => {
        if (r.status === 'completed') {
          await sendReportEmail(r, user.email)
        }
      })
      .catch((err) => console.error('Manual report generation error:', err))

    // Return immediately
    res.json({ status: 'generating', message: 'Report generation started. You will be notified when complete.' })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'report.generate',
      meta: { period },
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to start report generation' })
  }
})

// GET /api/reports/:id/download — Download report as HTML file
router.get('/:id/download', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const report = await Report.findOne({ _id: req.params.id, userId: String(user._id) }).lean()
    if (!report) return res.status(404).json({ error: 'Report not found' })

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `attachment; filename="lasa-report-${report._id}.html"`)
    res.send(report.htmlContent || '<h1>Report content not available</h1>')
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to download report' })
  }
})

// POST /api/reports/:id/resend — Resend report email
router.post('/:id/resend', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const report = await Report.findOne({ _id: req.params.id, userId: String(user._id) })
    if (!report) return res.status(404).json({ error: 'Report not found' })

    const result = await sendReportEmail(report, user.email)
    res.json({ ok: result.ok, message: result.ok ? 'Email sent' : 'Failed to send email' })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to resend report' })
  }
})

// PUT /api/reports/preferences — Update report preferences
router.put('/preferences', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const prefs = req.body || {}

    const update = {}
    if (typeof prefs.dailyReport === 'boolean') update['reportPreferences.dailyReport'] = prefs.dailyReport
    if (typeof prefs.weeklyReport === 'boolean') update['reportPreferences.weeklyReport'] = prefs.weeklyReport
    if (prefs.reportTime) update['reportPreferences.reportTime'] = prefs.reportTime
    if (['low', 'medium', 'high', 'critical'].includes(prefs.minRiskToEmail)) {
      update['reportPreferences.minRiskToEmail'] = prefs.minRiskToEmail
    }
    if (typeof prefs.includeRawStats === 'boolean') update['reportPreferences.includeRawStats'] = prefs.includeRawStats

    await User.updateOne({ _id: user._id }, { $set: update })
    const updated = await User.findById(user._id).lean()

    res.json({ ok: true, reportPreferences: updated.reportPreferences })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update preferences' })
  }
})

export default router

import express from 'express'
import Log from '../models/Log.js'
import Alert from '../models/Alert.js'
import Project from '../models/Project.js'
import { apiKeyAuth } from '../middleware/apiKeyAuth.js'
import { runDetection, calculateRiskScore, getSeverity } from '../services/detectionEngine.js'
import { generateAIReport } from '../services/aiAnalysis.js'
import { sendAlertEmail } from '../services/emailService.js'
import { broadcast } from '../services/wsManager.js'

const router = express.Router()

const RISK_THRESHOLD = 75

// Ingest logs from LASA agent (API key auth)
router.post('/ingest', apiKeyAuth, async (req, res) => {
    try {
        const { logs } = req.body
        const project = req.project

        if (!logs || !Array.isArray(logs)) {
            return res.status(400).json({ error: 'logs array is required.' })
        }

        const results = []

        for (const entry of logs) {
            // Run detection engine
            const detections = runDetection(entry)
            const riskScore = calculateRiskScore(detections, entry)
            const attackType = detections.length > 0 ? detections[0].type : null

            // Save log
            const log = new Log({
                projectId: project._id,
                ip: entry.ip || 'unknown',
                endpoint: entry.endpoint || entry.url || '/',
                method: entry.method || 'GET',
                statusCode: entry.statusCode || entry.status || 200,
                userAgent: entry.userAgent || '',
                rawLog: entry.rawLog || JSON.stringify(entry),
                attackType,
                riskScore,
                flagged: riskScore > 40,
            })

            await log.save()

            // Increment project log count
            await Project.findByIdAndUpdate(project._id, { $inc: { logCount: 1 } })

            // Broadcast to WebSocket
            broadcast(project._id.toString(), {
                type: 'new_log',
                log: log.toObject(),
            })

            // Check if risk exceeds threshold
            if (riskScore >= RISK_THRESHOLD && attackType) {
                const severity = getSeverity(riskScore)

                // Create alert
                const alert = new Alert({
                    projectId: project._id,
                    ip: entry.ip || 'unknown',
                    attackType,
                    severity,
                    riskScore,
                    description: `${attackType} detected from IP ${entry.ip}. ${detections.map(d => d.detail).join('. ')}`,
                })

                await alert.save()
                await Project.findByIdAndUpdate(project._id, { $inc: { threatCount: 1 } })

                // Broadcast alert
                broadcast(project._id.toString(), {
                    type: 'new_alert',
                    alert: alert.toObject(),
                })

                // Trigger AI analysis (async, don't block response)
                generateAIReport(alert, log, project).then(async (aiReport) => {
                    if (aiReport) {
                        alert.aiReport = aiReport
                        await alert.save()

                        // Send email notification
                        try {
                            await sendAlertEmail(project, alert, aiReport)
                            alert.emailSent = true
                            alert.emailSentAt = new Date()
                            await alert.save()
                        } catch (emailErr) {
                            console.error('Email send failed:', emailErr)
                        }
                    }
                }).catch(err => console.error('AI analysis error:', err))
            }

            results.push({
                id: log._id,
                attackType,
                riskScore,
                flagged: log.flagged,
            })
        }

        res.json({
            processed: results.length,
            results,
        })
    } catch (err) {
        console.error('Log ingestion error:', err)
        res.status(500).json({ error: 'Failed to process logs.' })
    }
})

// Get logs for a project
router.get('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params
        const { page = 1, limit = 50, attackType, ip } = req.query

        const filter = { projectId }
        if (attackType) filter.attackType = attackType
        if (ip) filter.ip = ip

        const logs = await Log.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const total = await Log.countDocuments(filter)

        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            }
        })
    } catch (err) {
        console.error('Get logs error:', err)
        res.status(500).json({ error: 'Failed to fetch logs.' })
    }
})

// Get log stats for a project
router.get('/:projectId/stats', async (req, res) => {
    try {
        const { projectId } = req.params

        const totalLogs = await Log.countDocuments({ projectId })
        const flaggedLogs = await Log.countDocuments({ projectId, flagged: true })

        const attackTypes = await Log.aggregate([
            { $match: { projectId: new (await import('mongoose')).default.Types.ObjectId(projectId), attackType: { $ne: null } } },
            { $group: { _id: '$attackType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ])

        const hourlyStats = await Log.aggregate([
            { $match: { projectId: new (await import('mongoose')).default.Types.ObjectId(projectId) } },
            {
                $group: {
                    _id: { $hour: '$createdAt' },
                    logs: { $sum: 1 },
                    threats: { $sum: { $cond: ['$flagged', 1, 0] } },
                }
            },
            { $sort: { '_id': 1 } },
        ])

        res.json({
            totalLogs,
            flaggedLogs,
            attackTypes,
            hourlyStats,
        })
    } catch (err) {
        console.error('Get log stats error:', err)
        res.status(500).json({ error: 'Failed to fetch stats.' })
    }
})

export default router

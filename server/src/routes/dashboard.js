import express from 'express'
import Project from '../models/Project.js'
import Log from '../models/Log.js'
import Alert from '../models/Alert.js'

const router = express.Router()

// Aggregated dashboard for a user (ownerId = Clerk user id)
router.get('/', async (req, res) => {
    try {
        const { ownerId } = req.query
        if (!ownerId) return res.status(400).json({ error: 'ownerId query param required.' })

        const projects = await Project.find({ ownerId }).sort({ createdAt: -1 }).lean()
        const projectIds = projects.map((p) => p._id)

        if (projectIds.length === 0) {
            return res.json({
                projects: [],
                stats: {
                    totalLogs: 0,
                    totalThreats: 0,
                    activeAlerts: 0,
                    riskLevel: 0,
                },
                recentLogs: [],
                recentAlerts: [],
                attackTypes: [],
                hourlyStats: Array.from({ length: 24 }, (_, i) => ({ _id: i, logs: 0, threats: 0 })),
            })
        }

        const [totalLogs, totalThreats, activeAlerts, recentLogs, recentAlerts, attackTypes, hourlyStats] = await Promise.all([
            Log.countDocuments({ projectId: { $in: projectIds } }),
            Log.countDocuments({ projectId: { $in: projectIds }, flagged: true }),
            Alert.countDocuments({ projectId: { $in: projectIds }, status: 'active' }),
            Log.find({ projectId: { $in: projectIds } })
                .sort({ createdAt: -1 })
                .limit(30)
                .lean(),
            Alert.find({ projectId: { $in: projectIds } })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean(),
            Log.aggregate([
                { $match: { projectId: { $in: projectIds }, attackType: { $ne: null } } },
                { $group: { _id: '$attackType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            Log.aggregate([
                { $match: { projectId: { $in: projectIds } } },
                {
                    $group: {
                        _id: { $hour: '$createdAt' },
                        logs: { $sum: 1 },
                        threats: { $sum: { $cond: ['$flagged', 1, 0] } },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ])

        const riskAgg = await Log.aggregate([
            { $match: { projectId: { $in: projectIds } } },
            { $group: { _id: null, avg: { $avg: '$riskScore' } } },
        ])
        const riskLevel = riskAgg[0] ? Math.round(riskAgg[0].avg) : 0

        const hourlyMap = Object.fromEntries(
            hourlyStats.map((h) => [h._id, h])
        )
        const fullHourly = Array.from({ length: 24 }, (_, i) => ({
            _id: i,
            logs: hourlyMap[i]?.logs ?? 0,
            threats: hourlyMap[i]?.threats ?? 0,
        }))

        res.json({
            projects,
            stats: {
                totalLogs,
                totalThreats,
                activeAlerts,
                riskLevel,
            },
            recentLogs,
            recentAlerts,
            attackTypes,
            hourlyStats: fullHourly,
        })
    } catch (err) {
        console.error('Dashboard error:', err)
        res.status(500).json({ error: 'Failed to fetch dashboard.' })
    }
})

// All logs for user (all projects)
router.get('/logs', async (req, res) => {
    try {
        const { ownerId, page = 1, limit = 50 } = req.query
        if (!ownerId) return res.status(400).json({ error: 'ownerId required.' })

        const projects = await Project.find({ ownerId }).select('_id').lean()
        const projectIds = projects.map((p) => p._id)
        if (projectIds.length === 0) {
            return res.json({ logs: [], pagination: { page: 1, limit: Number(limit), total: 0, pages: 0 } })
        }

        const skip = (Number(page) - 1) * Number(limit)
        const [logs, total] = await Promise.all([
            Log.find({ projectId: { $in: projectIds } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Log.countDocuments({ projectId: { $in: projectIds } }),
        ])

        res.json({
            logs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        })
    } catch (err) {
        console.error('Dashboard logs error:', err)
        res.status(500).json({ error: 'Failed to fetch logs.' })
    }
})

// All reports for user (all projects; only alerts with aiReport)
router.get('/reports', async (req, res) => {
    try {
        const { ownerId } = req.query
        if (!ownerId) return res.status(400).json({ error: 'ownerId required.' })

        const projects = await Project.find({ ownerId }).select('_id name').lean()
        const projectIds = projects.map((p) => p._id)
        if (projectIds.length === 0) {
            return res.json({ reports: [] })
        }

        const reports = await Alert.find({
            projectId: { $in: projectIds },
            'aiReport.fullReport': { $exists: true, $ne: null },
        })
            .select('attackType severity riskScore aiReport status createdAt ip')
            .sort({ createdAt: -1 })
            .lean()

        const projectMap = Object.fromEntries(projects.map((p) => [p._id.toString(), p.name]))
        const withProjectName = reports.map((r) => ({
            ...r,
            projectName: projectMap[r.projectId?.toString()] || 'Unknown',
        }))

        res.json({ reports: withProjectName })
    } catch (err) {
        console.error('Dashboard reports error:', err)
        res.status(500).json({ error: 'Failed to fetch reports.' })
    }
})

// All alerts for user (all projects)
router.get('/alerts', async (req, res) => {
    try {
        const { ownerId, page = 1, limit = 50, status } = req.query
        if (!ownerId) return res.status(400).json({ error: 'ownerId required.' })

        const projects = await Project.find({ ownerId }).select('_id').lean()
        const projectIds = projects.map((p) => p._id)
        if (projectIds.length === 0) {
            return res.json({ alerts: [], pagination: { page: 1, limit: Number(limit), total: 0, pages: 0 } })
        }

        const filter = { projectId: { $in: projectIds } }
        if (status) filter.status = status

        const skip = (Number(page) - 1) * Number(limit)
        const [alerts, total] = await Promise.all([
            Alert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Alert.countDocuments(filter),
        ])

        res.json({
            alerts,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        })
    } catch (err) {
        console.error('Dashboard alerts error:', err)
        res.status(500).json({ error: 'Failed to fetch alerts.' })
    }
})

export default router

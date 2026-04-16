import express from 'express'
import Alert from '../models/Alert.js'

const router = express.Router()

// Get alerts for a project
router.get('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params
        const { status, severity, page = 1, limit = 50 } = req.query

        const filter = { projectId }
        if (status) filter.status = status
        if (severity) filter.severity = severity

        const alerts = await Alert.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))

        const total = await Alert.countDocuments(filter)

        res.json({
            alerts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            }
        })
    } catch (err) {
        console.error('Get alerts error:', err)
        res.status(500).json({ error: 'Failed to fetch alerts.' })
    }
})

// Update alert status
router.patch('/:id', async (req, res) => {
    try {
        const { status } = req.body
        if (!['active', 'investigating', 'resolved'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' })
        }

        const alert = await Alert.findByIdAndUpdate(req.params.id, { status }, { new: true })
        if (!alert) return res.status(404).json({ error: 'Alert not found.' })

        res.json({ alert })
    } catch (err) {
        console.error('Update alert error:', err)
        res.status(500).json({ error: 'Failed to update alert.' })
    }
})

// Get alert with AI report
router.get('/detail/:id', async (req, res) => {
    try {
        const alert = await Alert.findById(req.params.id)
        if (!alert) return res.status(404).json({ error: 'Alert not found.' })

        res.json({ alert })
    } catch (err) {
        console.error('Get alert detail error:', err)
        res.status(500).json({ error: 'Failed to fetch alert.' })
    }
})

export default router

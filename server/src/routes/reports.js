import express from 'express'
import Alert from '../models/Alert.js'

const router = express.Router()

// Get all AI reports for a project
router.get('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params

        const reports = await Alert.find({
            projectId,
            'aiReport.fullReport': { $exists: true, $ne: null },
        })
            .select('attackType severity riskScore aiReport status createdAt ip')
            .sort({ createdAt: -1 })

        res.json({ reports })
    } catch (err) {
        console.error('Get reports error:', err)
        res.status(500).json({ error: 'Failed to fetch reports.' })
    }
})

export default router

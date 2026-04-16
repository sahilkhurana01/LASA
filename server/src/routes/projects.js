import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import Project from '../models/Project.js'
import Log from '../models/Log.js'
import Alert from '../models/Alert.js'

const router = express.Router()

// Create a new project
router.post('/', async (req, res) => {
    try {
        const { name, serverType, ownerId } = req.body

        if (!name || !ownerId) {
            return res.status(400).json({ error: 'Name and ownerId are required.' })
        }

        const apiKey = `lasa_pk_${uuidv4().replace(/-/g, '')}`

        const project = new Project({
            name,
            serverType: serverType || 'Node',
            ownerId,
            apiKey,
        })

        await project.save()

        res.status(201).json({
            project: {
                _id: project._id,
                name: project.name,
                serverType: project.serverType,
                apiKey: project.apiKey,
                createdAt: project.createdAt,
            }
        })
    } catch (err) {
        console.error('Create project error:', err)
        res.status(500).json({ error: 'Failed to create project.' })
    }
})

// Get all projects for a user
router.get('/', async (req, res) => {
    try {
        const { ownerId } = req.query
        if (!ownerId) return res.status(400).json({ error: 'ownerId query param required.' })

        const projects = await Project.find({ ownerId }).sort({ createdAt: -1 })
        res.json({ projects })
    } catch (err) {
        console.error('Get projects error:', err)
        res.status(500).json({ error: 'Failed to fetch projects.' })
    }
})

// Get single project
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
        if (!project) return res.status(404).json({ error: 'Project not found.' })

        const logCount = await Log.countDocuments({ projectId: project._id })
        const threatCount = await Log.countDocuments({ projectId: project._id, flagged: true })
        const activeAlerts = await Alert.countDocuments({ projectId: project._id, status: 'active' })

        res.json({
            project: {
                ...project.toObject(),
                logCount,
                threatCount,
                activeAlerts,
            }
        })
    } catch (err) {
        console.error('Get project error:', err)
        res.status(500).json({ error: 'Failed to fetch project.' })
    }
})

// Delete project
router.delete('/:id', async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(req.params.id)
        if (!project) return res.status(404).json({ error: 'Project not found.' })

        // Clean up associated data
        await Log.deleteMany({ projectId: project._id })
        await Alert.deleteMany({ projectId: project._id })

        res.json({ message: 'Project deleted.' })
    } catch (err) {
        console.error('Delete project error:', err)
        res.status(500).json({ error: 'Failed to delete project.' })
    }
})

export default router

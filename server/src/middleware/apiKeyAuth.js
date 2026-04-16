import Project from '../models/Project.js'

export async function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key']

    if (!apiKey) {
        return res.status(401).json({ error: 'Missing API key. Include X-API-KEY header.' })
    }

    try {
        const project = await Project.findOne({ apiKey, status: 'active' })
        if (!project) {
            return res.status(403).json({ error: 'Invalid or inactive API key.' })
        }

        req.project = project
        next()
    } catch (err) {
        console.error('API key auth error:', err)
        res.status(500).json({ error: 'Authentication error.' })
    }
}

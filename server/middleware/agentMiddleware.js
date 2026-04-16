import jwt from 'jsonwebtoken'
import Endpoint from '../models/Endpoint.js'

export async function requireAgentAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '')
    const { endpointId, userId } = payload || {}

    if (!endpointId || !userId) return res.status(401).json({ error: 'Invalid agent token' })

    const endpoint = await Endpoint.findOne({ _id: endpointId, userId }).lean()
    if (!endpoint) return res.status(401).json({ error: 'Endpoint not found for token' })

    req.agent = { endpointId, userId }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired agent token' })
  }
}


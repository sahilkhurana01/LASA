import { verifyToken } from '@clerk/backend'

function getBearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

export async function requireDashboardAuth(req, res, next) {
  const token = getBearerToken(req)
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })

  try {
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    const userId = verified?.sub
    if (!userId) return res.status(401).json({ error: 'Invalid auth token' })
    req.auth = { userId, sessionClaims: verified }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}


import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import dns from 'dns'


import authRoutes from './routes/auth.js'
import endpointRoutes from './routes/endpoints.js'
import logsRoutes from './routes/logs.js'
import ingestRoutes from './routes/ingest.js'
import blockedRoutes from './routes/blocked.js'
import alertsRoutes from './routes/alerts.js'
import statsRoutes from './routes/stats.js'
import auditRoutes from './routes/audit.js'
import userRoutes from './routes/user.js'
import ipLookupRoutes from './routes/ipLookup.js'
import reportsRoutes, { setReportsIO } from './routes/reports.js'
import notificationRoutes from './routes/notifications.js'
import alertRulesRoutes from './routes/alertRules.js'
import { initLogStream } from './socket/logStream.js'
import { initScheduler } from './services/scheduler.js'
import { initNotifications } from './services/notificationService.js'

dotenv.config()

// Helps with Atlas SRV issues on some networks
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1'])

const PORT = Number(process.env.PORT || 5000)
const MONGODB_URI = process.env.MONGODB_URI || ''

const app = express()
const httpServer = createServer(app)

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  },
})

initLogStream(io)
initNotifications(io)
setReportsIO(io)

app.use(helmet())
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

async function connectDB(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority',
      })
      console.log('✅ MongoDB connected')

      // Initialize scheduler after DB connection
      initScheduler(io)

      return
    } catch (err) {
      console.error(`❌ MongoDB connect attempt ${attempt}/${retries} failed:`, err?.message || err)
      if (attempt < retries) {
        const delay = Math.min(2000 * attempt, 10000)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  console.error('⚠️ MongoDB unavailable. API will error on DB routes.')
}

connectDB()

app.get('/api/health', (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting']
  res.json({
    status: 'ok',
    service: 'LASA API',
    database: dbState[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/endpoints', endpointRoutes)
app.use('/api/logs', logsRoutes)
app.use('/api/ingest', ingestRoutes(io))
app.use('/api/blocked', blockedRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/user', userRoutes)
app.use('/api/ip', ipLookupRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/alert-rules', alertRulesRoutes)

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

httpServer.listen(PORT, () => {
  console.log(`🛡️ LASA server running on :${PORT}`)
})

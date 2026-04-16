import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import dns from 'dns'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'

import projectRoutes from './routes/projects.js'
import logRoutes from './routes/logs.js'
import alertRoutes from './routes/alerts.js'
import reportRoutes from './routes/reports.js'
import dashboardRoutes from './routes/dashboard.js'
import { setupWebSocket } from './services/wsManager.js'

dotenv.config()

// Force Node.js to use Google DNS for SRV lookups (fixes ECONNREFUSED on some networks)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1'])

const app = express()
const server = createServer(app)

// ===================== MIDDLEWARE =====================
app.use(helmet())
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests, please try again later.' },
})
app.use('/api/', limiter)

// ===================== MONGODB =====================
const MONGODB_URI = process.env.MONGODB_URI || ''

async function connectDB(retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔄 MongoDB connection attempt ${attempt}/${retries}...`)
            await mongoose.connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10,
                retryWrites: true,
                w: 'majority',
            })
            console.log('✅ Connected to MongoDB Atlas')
            return
        } catch (err) {
            console.error(`❌ Attempt ${attempt} failed:`, err.message)
            if (attempt < retries) {
                const delay = Math.min(2000 * attempt, 10000)
                console.log(`⏳ Retrying in ${delay / 1000}s...`)
                await new Promise(r => setTimeout(r, delay))
            }
        }
    }
    console.error('⚠️  Could not connect to MongoDB after all retries. Server will run without DB.')
    console.error('⚠️  API endpoints requiring database will return errors.')
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB disconnected. Attempting reconnect...')
})

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message)
})

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected')
})

// Connect (non-blocking — server starts regardless)
connectDB()

// ===================== ROUTES =====================
app.use('/api/projects', projectRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Health check
app.get('/api/health', (req, res) => {
    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting']
    res.json({
        status: 'ok',
        service: 'LASA API',
        database: dbState[mongoose.connection.readyState] || 'unknown',
        timestamp: new Date().toISOString(),
    })
})

// ===================== WEBSOCKET =====================
const wss = new WebSocketServer({ server })
setupWebSocket(wss)

// ===================== START SERVER =====================
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
    console.log(`🛡️  LASA Server running on port ${PORT}`)
    console.log(`🔗 WebSocket server ready`)
    console.log(`📡 API: http://localhost:${PORT}/api`)
})

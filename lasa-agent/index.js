/**
 * LASA Agent
 * Lightweight log monitoring agent for the LASA Security Platform
 * 
 * Usage:
 *   import lasaAgent from 'lasa-agent'
 *   lasaAgent({
 *     apiKey: 'YOUR_API_KEY',
 *     logFilePath: './logs/access.log',
 *     endpoint: 'https://your-lasa-server.com',
 *   })
 */

import { readFileSync, watchFile, statSync } from 'fs'
import { resolve } from 'path'

const DEFAULT_ENDPOINT = 'http://localhost:5000'
const BATCH_SIZE = 10
const FLUSH_INTERVAL = 5000 // 5 seconds
const MAX_RETRIES = 3
const RETRY_DELAY = 2000

class LASAAgent {
    constructor(config) {
        this.apiKey = config.apiKey
        this.logFilePath = resolve(config.logFilePath)
        this.endpoint = (config.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '')
        this.lastSize = 0
        this.buffer = []
        this.running = false

        if (!this.apiKey) throw new Error('LASA Agent: apiKey is required')
        if (!this.logFilePath) throw new Error('LASA Agent: logFilePath is required')
    }

    start() {
        console.log(`🛡️  LASA Agent started`)
        console.log(`📁 Monitoring: ${this.logFilePath}`)
        console.log(`📡 Endpoint: ${this.endpoint}`)

        this.running = true

        // Get initial file size
        try {
            const stat = statSync(this.logFilePath)
            this.lastSize = stat.size
        } catch (err) {
            console.warn(`⚠️  Log file not found yet: ${this.logFilePath}`)
            this.lastSize = 0
        }

        // Watch for file changes
        watchFile(this.logFilePath, { interval: 1000 }, (curr, prev) => {
            if (curr.size > prev.size) {
                this.readNewLines(prev.size, curr.size)
            } else if (curr.size < prev.size) {
                // File was rotated
                this.lastSize = 0
                this.readNewLines(0, curr.size)
            }
        })

        // Periodic flush
        setInterval(() => this.flush(), FLUSH_INTERVAL)

        console.log('✅ LASA Agent is now monitoring your logs')
    }

    readNewLines(fromByte, toByte) {
        try {
            const fd = readFileSync(this.logFilePath, 'utf8')
            const newContent = fd.substring(fromByte, toByte)
            const lines = newContent.split('\n').filter(l => l.trim())

            for (const line of lines) {
                const parsed = this.parseLine(line)
                if (parsed) {
                    this.buffer.push(parsed)
                }
            }

            if (this.buffer.length >= BATCH_SIZE) {
                this.flush()
            }
        } catch (err) {
            console.error('LASA Agent: Error reading log file:', err.message)
        }
    }

    parseLine(line) {
        // Try to parse common log formats

        // Apache/Nginx combined log format
        const combinedRegex = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) \S+ "([^"]*)" "([^"]*)"/
        const match = line.match(combinedRegex)

        if (match) {
            return {
                ip: match[1],
                timestamp: new Date().toISOString(),
                method: match[3],
                endpoint: match[4],
                statusCode: parseInt(match[5]),
                userAgent: match[7],
                rawLog: line,
            }
        }

        // JSON log format
        try {
            const json = JSON.parse(line)
            return {
                ip: json.ip || json.remoteAddress || json.client_ip || 'unknown',
                timestamp: json.timestamp || new Date().toISOString(),
                method: json.method || 'GET',
                endpoint: json.url || json.endpoint || json.path || '/',
                statusCode: json.statusCode || json.status || json.response_code || 200,
                userAgent: json.userAgent || json.user_agent || '',
                rawLog: line,
            }
        } catch { }

        // Fallback: send raw line
        return {
            ip: 'unknown',
            timestamp: new Date().toISOString(),
            method: 'GET',
            endpoint: '/',
            statusCode: 200,
            rawLog: line,
        }
    }

    async flush() {
        if (this.buffer.length === 0) return

        const batch = this.buffer.splice(0, BATCH_SIZE)

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                let endpointId = '';
                try {
                    const payload = JSON.parse(atob(this.apiKey.split('.')[1]));
                    endpointId = payload.endpointId;
                } catch(e) {}

                const response = await fetch(`${this.endpoint}/api/ingest/${endpointId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': this.apiKey,
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({ logs: batch }),
                })

                if (response.ok) {
                    const data = await response.json()
                    console.log(`📤 Sent ${batch.length} logs → ${data.processed} processed`)
                    return
                }

                console.warn(`⚠️  API returned ${response.status}, retrying...`)
            } catch (err) {
                console.warn(`⚠️  Failed to send logs (attempt ${attempt + 1}/${MAX_RETRIES}):`, err.message)
            }

            if (attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)))
            }
        }

        // Put failed logs back in buffer
        this.buffer.unshift(...batch)
        console.error(`❌ Failed to send ${batch.length} logs after ${MAX_RETRIES} attempts`)
    }

    stop() {
        this.running = false
        console.log('🛑 LASA Agent stopped')
    }
}

export default function lasaAgent(config) {
    const agent = new LASAAgent(config)
    agent.start()
    return agent
}

/**
 * WebSocket Manager
 * Manages real-time connections per project channel
 */

const channels = new Map() // projectId -> Set<ws>

export function setupWebSocket(wss) {
    wss.on('connection', (ws, req) => {
        console.log('🔗 WebSocket client connected')

        let subscribedProject = null

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data)

                if (message.type === 'subscribe' && message.projectId) {
                    subscribedProject = message.projectId

                    if (!channels.has(subscribedProject)) {
                        channels.set(subscribedProject, new Set())
                    }
                    channels.get(subscribedProject).add(ws)

                    ws.send(JSON.stringify({
                        type: 'subscribed',
                        projectId: subscribedProject,
                    }))

                    console.log(`📡 Client subscribed to project: ${subscribedProject}`)
                }

                if (message.type === 'unsubscribe' && subscribedProject) {
                    const subs = channels.get(subscribedProject)
                    if (subs) {
                        subs.delete(ws)
                        if (subs.size === 0) channels.delete(subscribedProject)
                    }
                    subscribedProject = null
                }
            } catch (err) {
                console.error('WebSocket message parse error:', err)
            }
        })

        ws.on('close', () => {
            if (subscribedProject) {
                const subs = channels.get(subscribedProject)
                if (subs) {
                    subs.delete(ws)
                    if (subs.size === 0) channels.delete(subscribedProject)
                }
            }
            console.log('🔌 WebSocket client disconnected')
        })

        ws.on('error', (err) => {
            console.error('WebSocket error:', err)
        })

        // Send heartbeat
        ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }))
    })

    // Heartbeat every 30 seconds
    setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }))
            }
        })
    }, 30000)
}

export function broadcast(projectId, data) {
    const subs = channels.get(projectId)
    if (!subs || subs.size === 0) return

    const message = JSON.stringify(data)
    let sent = 0

    subs.forEach((ws) => {
        if (ws.readyState === 1) {
            ws.send(message)
            sent++
        }
    })

    if (sent > 0) {
        console.log(`📡 Broadcast to ${sent} client(s) on project ${projectId}`)
    }
}

export function initLogStream(io) {
  io.on('connection', (socket) => {
    // Client joins endpoint rooms after auth on frontend
    socket.on('join', ({ endpointId }) => {
      if (!endpointId) return
      socket.join(`endpoint:${endpointId}`)
    })

    socket.on('leave', ({ endpointId }) => {
      if (!endpointId) return
      socket.leave(`endpoint:${endpointId}`)
    })

    // Join user-specific room for notifications/reports
    socket.on('join:user', ({ userId }) => {
      if (!userId) return
      socket.join(`user:${userId}`)
    })

    socket.on('leave:user', ({ userId }) => {
      if (!userId) return
      socket.leave(`user:${userId}`)
    })
  })
}

export function emitLog(io, endpointId, payload) {
  io.to(`endpoint:${endpointId}`).emit('log', payload)
}

export function emitAlert(io, endpointId, payload) {
  io.to(`endpoint:${endpointId}`).emit('alert', payload)
}

export function emitThreatFeed(io, payload) {
  io.emit('threat-feed', payload)
}

export function emitIPEnriched(io, payload) {
  io.emit('ip:enriched', payload)
}

import Notification from '../models/Notification.js'

let ioRef = null

export function initNotifications(io) {
  ioRef = io
}

export async function createNotification({ userId, type, title, message, severity, link, meta }) {
  try {
    const notif = await Notification.create({
      userId,
      type: type || 'info',
      title: title || 'Notification',
      message: message || '',
      severity: severity || 'low',
      link: link || null,
      meta: meta || null,
    })

    // Emit real-time notification
    if (ioRef) {
      ioRef.to(`user:${userId}`).emit('notification', {
        id: notif._id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        severity: notif.severity,
        link: notif.link,
        createdAt: notif.createdAt,
      })
    }

    return notif
  } catch (err) {
    console.error('Failed to create notification:', err)
    return null
  }
}

// Smart alert deduplication — 15 min cooldown per IP per threat type
const alertCooldowns = new Map()

export function shouldAlert(ip, threatType) {
  const key = `${ip}:${threatType}`
  const last = alertCooldowns.get(key)
  const now = Date.now()

  if (last && now - last < 15 * 60 * 1000) return false // 15 min cooldown
  alertCooldowns.set(key, now)

  // Cleanup old entries every 100 additions
  if (alertCooldowns.size > 1000) {
    for (const [k, v] of alertCooldowns.entries()) {
      if (now - v > 30 * 60 * 1000) alertCooldowns.delete(k)
    }
  }

  return true
}

// Group alerts for same IP
const alertGrouping = new Map()

export function groupAlert(ip, threatType) {
  const key = `${ip}:${threatType}`
  const group = alertGrouping.get(key) || { count: 0, firstAt: Date.now() }
  group.count++
  group.lastAt = Date.now()
  alertGrouping.set(key, group)

  // Return grouped info every 10 seconds
  if (group.count > 1 && Date.now() - group.firstAt < 60_000) {
    return { grouped: true, count: group.count, message: `IP ${ip} attempted ${group.count} ${threatType} attacks in the last minute` }
  }

  // Reset group after 60 seconds
  if (Date.now() - group.firstAt > 60_000) {
    alertGrouping.delete(key)
    return { grouped: false, count: 1 }
  }

  return { grouped: false, count: group.count }
}

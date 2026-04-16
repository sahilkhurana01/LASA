import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { Shield, LayoutDashboard, Activity, Boxes, Ban, Bell, Settings, LogOut, NotebookPen, FileText, Radar, Zap, X } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import toast from 'react-hot-toast'

import { cn } from '@/shared/cn'
import { apiFetch, toastApiError } from '@/shared/api'
import { useAppStore } from '@/state/appStore'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) || 'http://localhost:5000'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/endpoints', label: 'Endpoints', icon: Boxes },
  { to: '/dashboard/logs', label: 'Live Logs', icon: Activity },
  { to: '/dashboard/blocked-ips', label: 'Blocked IPs', icon: Ban },
  { to: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { to: '/dashboard/reports', label: 'Reports', icon: FileText },
  { to: '/dashboard/ip-intelligence', label: 'IP Intel', icon: Radar },
  { to: '/dashboard/alert-rules', label: 'Alert Rules', icon: Zap },
  { to: '/dashboard/audit', label: 'Audit', icon: NotebookPen },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

type Notification = {
  _id: string
  type: string
  title: string
  message: string
  severity: string
  link: string | null
  read: boolean
  createdAt: string
}

export function DashboardLayout() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { getToken, signOut } = useAuth()
  const unreadAlerts = useAppStore((s) => s.unreadAlerts)
  const setUnread = useAppStore((s) => s.setUnreadAlerts)
  const selectedEndpointId = useAppStore((s) => s.selectedEndpointId)
  const socketRef = React.useRef<Socket | null>(null)

  // Notification center state
  const [notifOpen, setNotifOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [notifUnread, setNotifUnread] = React.useState(0)

  // Threat feed state
  const [threatFeed, setThreatFeed] = React.useState<any[]>([])

  // Sync user on load
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      const r = await apiFetch<{ user: any }>('/auth/sync', { method: 'POST', token })
      if (cancelled) return
      if (!r.ok) toastApiError(r)
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [getToken])

  // Poll unread count
  React.useEffect(() => {
    let alive = true
    const tick = async () => {
      const token = await getToken()
      const r = await apiFetch<{ count: number }>('/alerts/unread-count', { token })
      if (!alive) return
      if (r.ok) setUnread(r.data.count)

      // Also poll notification count
      const n = await apiFetch<{ count: number }>('/notifications/unread-count', { token })
      if (!alive) return
      if (n.ok) setNotifUnread(n.data.count)
    }
    tick().catch(() => {})
    const id = window.setInterval(() => tick().catch(() => {}), 15_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [getToken, setUnread])

  // Socket.io connection (joins selected endpoint room + user room)
  React.useEffect(() => {
    const s = io(WS_URL, { transports: ['websocket'] })
    socketRef.current = s
    s.on('connect', () => {})
    s.on('alert', () => setUnread(unreadAlerts + 1))

    // Real-time notification
    s.on('notification', (n: any) => {
      setNotifUnread((prev) => prev + 1)
      setNotifications((prev) => [n, ...prev].slice(0, 30))
    })

    // Threat feed
    s.on('threat-feed', (item: any) => {
      setThreatFeed((prev) => [item, ...prev].slice(0, 50))
    })

    s.on('connect_error', () => toast.error('Realtime connection failed'))
    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [setUnread, unreadAlerts])

  React.useEffect(() => {
    const s = socketRef.current
    if (!s) return
    if (selectedEndpointId) s.emit('join', { endpointId: selectedEndpointId })
    return () => {
      if (selectedEndpointId) s.emit('leave', { endpointId: selectedEndpointId })
    }
  }, [selectedEndpointId])

  // Load notifications on bell click
  async function loadNotifications() {
    const token = await getToken()
    const r = await apiFetch<{ notifications: Notification[]; unreadCount: number }>('/notifications', { token, query: { limit: 15 } })
    if (r.ok) {
      setNotifications(r.data.notifications)
      setNotifUnread(r.data.unreadCount)
    }
  }

  async function markAllRead() {
    const token = await getToken()
    await apiFetch('/notifications/mark-all-read', { method: 'POST', token })
    setNotifUnread(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function notifSeverityColor(sev: string) {
    if (sev === 'critical') return '#ff2d55'
    if (sev === 'high') return '#ff8c00'
    if (sev === 'medium') return '#ffb800'
    return '#00f5ff'
  }

  return (
    <div className="min-h-screen grid-bg scanline">
      {/* Threat Feed Ticker */}
      {threatFeed.length > 0 && (
        <div className="bg-[rgba(0,0,0,0.6)] border-b border-[rgba(0,245,255,0.08)] overflow-hidden">
          <div className="mx-auto max-w-[1400px] px-4 py-1.5">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
              <Badge tone="danger" className="flex-shrink-0 text-[10px]">LIVE FEED</Badge>
              {threatFeed.slice(0, 8).map((item, i) => (
                <div key={i} className="flex-shrink-0 text-[11px] text-[var(--color-muted)] flex items-center gap-1.5 border-r border-[rgba(0,245,255,0.06)] pr-3">
                  <span style={{ color: item.blocked ? '#ff2d55' : '#ffb800' }}>{item.blocked ? '🛡️' : '⚠️'}</span>
                  <span className="font-mono">{item.ip}</span>
                  <span className="text-[var(--color-muted)]">→</span>
                  <span>{item.threatType || 'Threat'}</span>
                  <span className="text-[var(--color-muted)]">on</span>
                  <span className="text-[var(--color-cyan)]">{item.endpointName}</span>
                  {item.blocked && <Badge tone="danger" className="text-[8px]">BLOCKED</Badge>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="card rounded-2xl p-4 lg:sticky lg:top-6 h-fit glow-hover">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-10 w-10 rounded-2xl bg-[rgba(0,245,255,0.08)] border border-[rgba(0,245,255,0.14)] grid place-items-center">
                <Shield className="h-5 w-5 text-[var(--color-cyan)]" />
              </div>
              <div className="leading-tight">
                <div className="text-xs tracking-wide text-[var(--color-muted)]">LASA</div>
                <div className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                  Security Ops
                </div>
              </div>
            </div>

            <nav className="mt-3 space-y-1">
              {nav.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition border',
                      isActive
                        ? 'border-[rgba(0,245,255,0.20)] bg-[rgba(0,245,255,0.08)]'
                        : 'border-transparent hover:border-[rgba(0,245,255,0.10)] hover:bg-white/3',
                    )
                  }
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-[rgba(255,255,255,0.70)]" />
                    {label}
                  </span>
                  {label === 'Alerts' && unreadAlerts > 0 && <Badge tone="danger">{unreadAlerts}</Badge>}
                </NavLink>
              ))}
            </nav>

            <div className="mt-4 border-t border-[rgba(0,245,255,0.10)] pt-4 px-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{user?.fullName || 'Operator'}</div>
                  <div className="text-xs text-[var(--color-muted)] truncate">{user?.primaryEmailAddress?.emailAddress}</div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Notification Bell */}
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNotifOpen(!notifOpen)
                        if (!notifOpen) loadNotifications()
                      }}
                    >
                      <Bell className="h-4 w-4" />
                      {notifUnread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[var(--color-danger)] text-[10px] font-semibold flex items-center justify-center px-1">
                          {notifUnread > 9 ? '9+' : notifUnread}
                        </span>
                      )}
                    </Button>

                    {/* Notification Dropdown */}
                    {notifOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-80 max-h-96 overflow-auto card rounded-2xl border border-[rgba(0,245,255,0.12)] z-50 shadow-2xl">
                        <div className="sticky top-0 bg-[var(--color-card)] px-4 py-3 border-b border-[rgba(0,245,255,0.10)] flex items-center justify-between">
                          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Notifications</span>
                          <div className="flex items-center gap-1">
                            {notifUnread > 0 && (
                              <button onClick={markAllRead} className="text-[10px] text-[var(--color-cyan)] hover:underline">Mark all read</button>
                            )}
                            <button onClick={() => setNotifOpen(false)} className="p-1 hover:bg-white/5 rounded">
                              <X className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                            </button>
                          </div>
                        </div>
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">No notifications</div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n._id}
                              className={cn(
                                'px-4 py-3 border-b border-[rgba(0,245,255,0.06)] cursor-pointer hover:bg-white/2 transition',
                                !n.read && 'bg-[rgba(0,245,255,0.03)]',
                              )}
                              onClick={() => {
                                if (n.link) navigate(n.link)
                                setNotifOpen(false)
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: notifSeverityColor(n.severity) }} />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate">{n.title}</div>
                                  <div className="text-[11px] text-[var(--color-muted)] truncate">{n.message}</div>
                                  <div className="text-[10px] text-[var(--color-muted)] mt-1">
                                    {new Date(n.createdAt).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await signOut()
                      toast.success('Signed out')
                      navigate('/login')
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

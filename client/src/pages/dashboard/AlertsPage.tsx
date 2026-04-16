import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import { Download, RefreshCcw, CheckCheck } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'

type AlertRow = any

const tabs = ['all', 'critical', 'high', 'medium', 'low'] as const

export function AlertsPage() {
  const { getToken } = useAuth()
  const [alerts, setAlerts] = React.useState<AlertRow[]>([])
  const [severity, setSeverity] = React.useState<(typeof tabs)[number]>('all')
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    const r = await apiFetch<{ alerts: AlertRow[] }>('/alerts', { token, query: { severity } })
    if (!r.ok) toastApiError(r)
    else setAlerts(r.data.alerts)
    setLoading(false)
  }, [getToken, severity])

  React.useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  async function markAllRead() {
    const token = await getToken()
    const r = await apiFetch<{ ok: true }>('/alerts/mark-all-read', { method: 'POST', token })
    if (!r.ok) return toastApiError(r)
    toast.success('Marked all as read')
    setAlerts((p) => p.map((a) => ({ ...a, read: true })))
  }

  async function markRead(id: string) {
    const token = await getToken()
    const r = await apiFetch<{ ok: true }>('/alerts/mark-read', { method: 'POST', token, body: JSON.stringify({ ids: [id] }) })
    if (!r.ok) return toastApiError(r)
    setAlerts((p) => p.map((a) => (a._id === id ? { ...a, read: true } : a)))
  }

  async function exportCsv() {
    const token = await getToken()
    const base = (import.meta.env.VITE_API_URL as string | undefined) || '/api'
    const url = new URL(base + '/alerts/export.csv', window.location.origin)
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return toast.error('Export failed')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'lasa-alerts.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Alerts center</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Alerts</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => load()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="primary" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setSeverity(t)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                severity === t
                  ? 'border-[rgba(0,245,255,0.20)] bg-[rgba(0,245,255,0.08)]'
                  : 'border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgba(0,245,255,0.10)] flex items-center justify-between">
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Notifications</div>
          <Badge tone="cyan">{loading ? 'loading' : `${alerts.length}`}</Badge>
        </div>
        <ul className="divide-y divide-[rgba(0,245,255,0.06)]">
          {alerts.map((a) => (
            <li key={a._id} className="px-5 py-4 hover:bg-white/2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={(a.severity === 'critical' || a.severity === 'high') ? 'danger' : a.severity === 'medium' ? 'warn' : 'neutral'}>
                      {a.severity?.toUpperCase?.() ?? 'ALERT'}
                    </Badge>
                    {!a.read && <Badge tone="cyan">UNREAD</Badge>}
                    <Badge tone="neutral" className="font-mono">{a.endpointName ?? String(a.endpointId).slice(0, 6) + '…'}</Badge>
                    <span className="text-xs text-[var(--color-muted)]">{new Date(a.sentAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-sm">{a.message}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => window.location.href = `/dashboard/logs?q=${encodeURIComponent(a.message ?? '')}`}>
                    View log
                  </Button>
                  {!a.read && (
                    <Button size="sm" variant="primary" onClick={() => markRead(a._id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {!loading && alerts.length === 0 && (
            <li className="px-5 py-10 text-sm text-[var(--color-muted)]">No alerts found.</li>
          )}
        </ul>
      </Card>
    </div>
  )
}


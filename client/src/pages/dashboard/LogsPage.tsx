import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import { io, type Socket } from 'socket.io-client'
import toast from 'react-hot-toast'
import { Search, Download, Radio } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { useAppStore } from '@/state/appStore'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { Modal } from '@/ui/Modal'

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) || 'http://localhost:5000'

type Endpoint = { _id: string; name: string; status: 'online' | 'offline' }
type LogRow = any

export function LogsPage() {
  const { getToken } = useAuth()
  const selectedEndpointId = useAppStore((s) => s.selectedEndpointId)
  const setSelected = useAppStore((s) => s.setSelectedEndpointId)

  const [endpoints, setEndpoints] = React.useState<Endpoint[]>([])
  const [logs, setLogs] = React.useState<LogRow[]>([])
  const [q, setQ] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [live, setLive] = React.useState(false)
  const [detail, setDetail] = React.useState<LogRow | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const socketRef = React.useRef<Socket | null>(null)

  const loadEndpoints = React.useCallback(async () => {
    const token = await getToken()
    const r = await apiFetch<{ endpoints: Endpoint[] }>('/endpoints', { token })
    if (!r.ok) toastApiError(r)
    else setEndpoints(r.data.endpoints)
  }, [getToken])

  const loadLogs = React.useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    const r = await apiFetch<{ logs: LogRow[] }>('/logs', {
      token,
      query: { endpointId: selectedEndpointId || undefined, q: q || undefined, limit: 100 },
    })
    if (!r.ok) toastApiError(r)
    else setLogs(r.data.logs)
    setLoading(false)
  }, [getToken, selectedEndpointId, q])

  React.useEffect(() => {
    loadEndpoints().catch(() => {})
  }, [loadEndpoints])

  React.useEffect(() => {
    loadLogs().catch(() => setLoading(false))
  }, [loadLogs])

  React.useEffect(() => {
    const s = io(WS_URL, { transports: ['websocket'] })
    socketRef.current = s
    s.on('connect', () => {})
    s.on('log', (payload) => {
      const log = payload?.log
      if (!log) return
      setLogs((prev) => [log, ...prev].slice(0, 200))
    })
    s.on('connect_error', () => toast.error('Realtime logs connection failed'))
    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const s = socketRef.current
    if (!s) return
    if (selectedEndpointId) {
      s.emit('join', { endpointId: selectedEndpointId })
      setLive(true)
      return () => {
        s.emit('leave', { endpointId: selectedEndpointId })
        setLive(false)
      }
    }
  }, [selectedEndpointId])

  const exportUrl = async () => {
    const token = await getToken()
    const base = (import.meta.env.VITE_API_URL as string | undefined) || '/api'
    const url = new URL(base + '/logs/export.csv', window.location.origin)
    if (selectedEndpointId) url.searchParams.set('endpointId', selectedEndpointId)
    // Manual download with auth token (fetch blob)
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return toast.error('Export failed')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'lasa-logs.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <Card className="p-4 h-fit lg:sticky lg:top-6">
        <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Endpoints</div>
        <div className="mt-3 space-y-1">
          {endpoints.map((e) => (
            <button
              key={e._id}
              className={`w-full text-left rounded-xl px-3 py-2 text-sm border transition ${
                selectedEndpointId === e._id
                  ? 'border-[rgba(0,245,255,0.20)] bg-[rgba(0,245,255,0.08)]'
                  : 'border-transparent hover:border-[rgba(0,245,255,0.10)] hover:bg-white/3'
              }`}
              onClick={() => setSelected(e._id)}
            >
              <div className="flex items-center justify-between">
                <span>{e.name}</span>
                <span className={`h-2 w-2 rounded-full ${e.status === 'online' ? 'bg-[var(--color-success)]' : 'bg-white/20'}`} />
              </div>
            </button>
          ))}
          {endpoints.length === 0 && <div className="mt-2 text-sm text-[var(--color-muted)]">No endpoints yet.</div>}
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={live ? 'danger' : 'neutral'}>
                <Radio className="h-3.5 w-3.5 mr-1" />
                {live ? 'LIVE' : 'IDLE'}
              </Badge>
              <div className="text-sm text-[var(--color-muted)]">Streaming + historical search</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-[360px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (text) ip, path, user-agent…" />
              </div>
              <Button size="sm" onClick={() => loadLogs()}>
                Search
              </Button>
              <Button size="sm" onClick={exportUrl}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(0,245,255,0.10)] flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Logs</div>
            <Badge tone="cyan">{loading ? 'loading' : `${logs.length}`}</Badge>
          </div>
          <div className="overflow-auto max-h-[680px]">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="text-xs text-[var(--color-muted)]">
                <tr className="border-b border-[rgba(0,245,255,0.08)]">
                  <th className="text-left font-medium px-5 py-3">Time</th>
                  <th className="text-left font-medium px-5 py-3">IP</th>
                  <th className="text-left font-medium px-5 py-3">Method</th>
                  <th className="text-left font-medium px-5 py-3">Path</th>
                  <th className="text-left font-medium px-5 py-3">Status</th>
                  <th className="text-left font-medium px-5 py-3">Threat</th>
                  <th className="text-left font-medium px-5 py-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,245,255,0.06)]">
                {logs.map((l) => (
                  <tr
                    key={l._id}
                    className={`cursor-pointer ${l.isSuspicious ? 'bg-[rgba(255,45,85,0.06)]' : 'hover:bg-white/2'}`}
                    onClick={() => { setDetail(l); setDetailOpen(true) }}
                  >
                    <td className="px-5 py-3 text-[var(--color-muted)] whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-xs">{l.ip}</td>
                    <td className="px-5 py-3">{l.method}</td>
                    <td className="px-5 py-3 font-mono text-xs">{l.path}</td>
                    <td className="px-5 py-3">{l.statusCode}</td>
                    <td className="px-5 py-3">{l.threatType || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge
                        tone={
                          l.aiAnalysis?.severity === 'critical' || l.aiAnalysis?.severity === 'high'
                            ? 'danger'
                            : l.aiAnalysis?.severity === 'medium'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {l.aiAnalysis?.severity || 'low'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td className="px-5 py-8 text-[var(--color-muted)]" colSpan={7}>
                      No logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal open={detailOpen} title="Log details" onClose={() => setDetailOpen(false)} className="max-w-3xl">
          {!detail ? null : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="cyan">{detail.method}</Badge>
                <Badge tone="neutral" className="font-mono">{detail.ip}</Badge>
                {detail.isSuspicious && <Badge tone="danger">Suspicious</Badge>}
                {detail.threatType && <Badge tone="warn">{detail.threatType}</Badge>}
              </div>
              <div className="rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="text-xs text-[var(--color-muted)]">AI analysis</div>
                <div className="mt-2 text-sm whitespace-pre-wrap text-[var(--color-muted)]">
                  {detail.aiAnalysis?.reason || '—'}
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="text-xs text-[var(--color-muted)]">Raw</div>
                <pre className="mt-2 text-xs overflow-auto">{detail.rawLog}</pre>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}


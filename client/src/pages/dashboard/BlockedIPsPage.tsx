import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import { Plus, Trash2, RefreshCcw, Globe, CheckSquare2 } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { Badge } from '@/ui/Badge'
import { Modal } from '@/ui/Modal'

type Blocked = any

export function BlockedIPsPage() {
  const { getToken } = useAuth()
  const [rows, setRows] = React.useState<Blocked[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [geo, setGeo] = React.useState<Record<string, { country?: string; city?: string }>>({})
  const [open, setOpen] = React.useState(false)
  const [endpointId, setEndpointId] = React.useState('')
  const [ip, setIp] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [durationMinutes, setDurationMinutes] = React.useState('60')

  const load = React.useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    const r = await apiFetch<{ blocked: Blocked[] }>('/blocked', { token })
    if (!r.ok) toastApiError(r)
    else setRows(r.data.blocked)
    setLoading(false)
  }, [getToken])

  React.useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  // auto-refresh every 30s
  React.useEffect(() => {
    const id = window.setInterval(() => load().catch(() => {}), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  // Geo lookup via ip-api (client-side cache)
  React.useEffect(() => {
    const ips = rows.map((r) => r.ip).filter(Boolean) as string[]
    const unique = Array.from(new Set(ips)).slice(0, 30)
    unique.forEach((ipAddr) => {
      if (geo[ipAddr]) return
      fetch(`http://ip-api.com/json/${encodeURIComponent(ipAddr)}?fields=status,country,city,query`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.status !== 'success') return
          setGeo((prev) => ({ ...prev, [ipAddr]: { country: d.country, city: d.city } }))
        })
        .catch(() => {})
    })
  }, [rows, geo])

  async function block() {
    const token = await getToken()
    const r = await apiFetch<{ blocked: Blocked }>('/blocked', {
      method: 'POST',
      token,
      body: JSON.stringify({
        endpointId: endpointId.trim(),
        ip: ip.trim(),
        reason,
        durationMinutes: Number(durationMinutes || 60),
      }),
    })
    if (!r.ok) return toastApiError(r)
    toast.success('IP blocked')
    setOpen(false)
    setRows((p) => [r.data.blocked, ...p])
    setEndpointId('')
    setIp('')
    setReason('')
  }

  async function unblock(id: string) {
    const token = await getToken()
    const r = await apiFetch<{ ok: true }>(`/blocked/${id}`, { method: 'DELETE', token })
    if (!r.ok) return toastApiError(r)
    toast.success('Unblocked')
    setRows((p) => p.filter((x) => x._id !== id))
  }

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)

  async function bulkUnblock() {
    if (selectedIds.length === 0) return
    if (!confirm(`Unblock ${selectedIds.length} IP(s)?`)) return
    const token = await getToken()
    const r = await apiFetch<{ ok: true; deleted: number }>('/blocked/bulk-delete', {
      method: 'POST',
      token,
      body: JSON.stringify({ ids: selectedIds }),
    })
    if (!r.ok) return toastApiError(r)
    toast.success(`Unblocked ${r.data.deleted}`)
    setRows((p) => p.filter((x) => !selectedIds.includes(x._id)))
    setSelected({})
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Blocklist</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Blocked IPs</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => load()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={bulkUnblock} disabled={selectedIds.length === 0}>
            <CheckSquare2 className="h-4 w-4" /> Bulk unblock ({selectedIds.length})
          </Button>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Block IP
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgba(0,245,255,0.10)] flex items-center justify-between">
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Entries</div>
          <Badge tone="cyan">{loading ? 'loading' : `${rows.length}`}</Badge>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="text-xs text-[var(--color-muted)]">
              <tr className="border-b border-[rgba(0,245,255,0.08)]">
                <th className="text-left font-medium px-5 py-3">Sel</th>
                <th className="text-left font-medium px-5 py-3">IP</th>
                <th className="text-left font-medium px-5 py-3">Endpoint</th>
                <th className="text-left font-medium px-5 py-3">Geo</th>
                <th className="text-left font-medium px-5 py-3">Reason</th>
                <th className="text-left font-medium px-5 py-3">Blocked</th>
                <th className="text-left font-medium px-5 py-3">Expires</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,245,255,0.06)]">
              {rows.map((r) => (
                <tr key={r._id} className="hover:bg-white/2">
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={!!selected[r._id]}
                      onChange={(e) => setSelected((p) => ({ ...p, [r._id]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{r.ip}</td>
                  <td className="px-5 py-3">{r.endpointName ?? r.endpointId}</td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">
                    {geo[r.ip]?.country ? (
                      <span className="inline-flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {geo[r.ip]?.country}{geo[r.ip]?.city ? ` • ${geo[r.ip]?.city}` : ''}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">{r.reason}</td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">{new Date(r.blockedAt).toLocaleString()}</td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="danger" onClick={() => unblock(r._id)}>
                      <Trash2 className="h-4 w-4" /> Unblock
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-5 py-8 text-[var(--color-muted)]" colSpan={8}>
                    No blocked IPs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} title="Manual block" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-[var(--color-muted)]">EndpointId</div>
            <Input value={endpointId} onChange={(e) => setEndpointId(e.target.value)} placeholder="Paste endpointId" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)]">IP address</div>
            <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="1.2.3.4" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)]">Reason</div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Manual block" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)]">Duration (minutes)</div>
            <Input value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={block} disabled={!endpointId.trim() || !ip.trim()}>
              Block
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}


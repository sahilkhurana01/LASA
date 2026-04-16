import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import { RefreshCcw } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'

type AuditEvent = any

export function AuditPage() {
  const { getToken } = useAuth()
  const [events, setEvents] = React.useState<AuditEvent[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    const r = await apiFetch<{ events: AuditEvent[] }>('/audit', { token, query: { limit: 100 } })
    if (!r.ok) toastApiError(r)
    else setEvents(r.data.events)
    setLoading(false)
  }, [getToken])

  React.useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Audit trail</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Audit</div>
        </div>
        <Button size="sm" onClick={() => load()}>
          <RefreshCcw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgba(0,245,255,0.10)] flex items-center justify-between">
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Events</div>
          <Badge tone="cyan">{loading ? 'loading' : `${events.length}`}</Badge>
        </div>
        <div className="overflow-auto max-h-[720px]">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="text-xs text-[var(--color-muted)]">
              <tr className="border-b border-[rgba(0,245,255,0.08)]">
                <th className="text-left font-medium px-5 py-3">Time</th>
                <th className="text-left font-medium px-5 py-3">Action</th>
                <th className="text-left font-medium px-5 py-3">Endpoint</th>
                <th className="text-left font-medium px-5 py-3">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,245,255,0.06)]">
              {events.map((e) => (
                <tr key={e._id} className="hover:bg-white/2">
                  <td className="px-5 py-3 text-[var(--color-muted)] whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono text-xs">{e.action}</td>
                  <td className="px-5 py-3 font-mono text-xs">{e.endpointId ? String(e.endpointId).slice(0, 6) + '…' : '—'}</td>
                  <td className="px-5 py-3">
                    <pre className="text-xs overflow-auto max-w-[520px]">{JSON.stringify(e.meta ?? {}, null, 2)}</pre>
                  </td>
                </tr>
              ))}
              {!loading && events.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-[var(--color-muted)]" colSpan={4}>
                    No audit events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}


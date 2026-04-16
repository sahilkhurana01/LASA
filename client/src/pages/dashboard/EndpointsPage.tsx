import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Copy, Plus, RefreshCcw, Trash2, Link2, ShieldAlert, Sliders } from 'lucide-react'
import toast from 'react-hot-toast'

import { apiFetch, toastApiError } from '@/shared/api'
import { useAppStore } from '@/state/appStore'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { Badge } from '@/ui/Badge'
import { Modal } from '@/ui/Modal'

type Endpoint = {
  _id: string
  name: string
  url: string
  agentToken: string
  status: 'online' | 'offline'
  lastSeenAt: string | null
  logsToday?: number
  threatsToday?: number
  webhookUrl?: string | null
  rateLimitRule?: { enabled: boolean; blockAfter: number; windowMinutes: number; severityThreshold: string }
}

export function EndpointsPage() {
  const { getToken } = useAuth()
  const setSelected = useAppStore((s) => s.setSelectedEndpointId)
  const selected = useAppStore((s) => s.selectedEndpointId)

  const [endpoints, setEndpoints] = React.useState<Endpoint[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const [setupOpen, setSetupOpen] = React.useState(false)
  const [setupEndpoint, setSetupEndpoint] = React.useState<Endpoint | null>(null)

  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [settingsEndpoint, setSettingsEndpoint] = React.useState<Endpoint | null>(null)
  const [webhookUrl, setWebhookUrl] = React.useState('')
  const [ruleEnabled, setRuleEnabled] = React.useState(true)
  const [blockAfter, setBlockAfter] = React.useState('5')
  const [windowMinutes, setWindowMinutes] = React.useState('10')
  const [severityThreshold, setSeverityThreshold] = React.useState('medium')

  const load = React.useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    const r = await apiFetch<{ endpoints: Endpoint[] }>('/endpoints', { token })
    if (!r.ok) toastApiError(r)
    else setEndpoints(r.data.endpoints)
    setLoading(false)
  }, [getToken])

  React.useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  async function createEndpoint() {
    setSaving(true)
    const token = await getToken()
    const r = await apiFetch<{ endpoint: Endpoint }>('/endpoints', {
      method: 'POST',
      token,
      body: JSON.stringify({ name: name.trim(), url: url.trim() }),
    })
    setSaving(false)
    if (!r.ok) return toastApiError(r)
    toast.success('Endpoint created')
    setOpen(false)
    setName('')
    setUrl('')
    setEndpoints((prev) => [r.data.endpoint, ...prev])
  }

  async function regenerateToken(id: string) {
    const token = await getToken()
    const r = await apiFetch<{ endpoint: Endpoint }>(`/endpoints/${id}/regenerate-token`, { method: 'POST', token })
    if (!r.ok) return toastApiError(r)
    toast.success('Token regenerated')
    setEndpoints((prev) => prev.map((e) => (e._id === id ? r.data.endpoint : e)))
  }

  async function deleteEndpoint(id: string) {
    if (!confirm('Delete endpoint and all logs?')) return
    const token = await getToken()
    const r = await apiFetch<{ ok: true }>(`/endpoints/${id}`, { method: 'DELETE', token })
    if (!r.ok) return toastApiError(r)
    toast.success('Endpoint deleted')
    setEndpoints((prev) => prev.filter((e) => e._id !== id))
    if (selected === id) setSelected(null)
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  async function saveSettings() {
    if (!settingsEndpoint) return
    const token = await getToken()
    const r = await apiFetch<{ endpoint: Endpoint }>(`/endpoints/${settingsEndpoint._id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        webhookUrl: webhookUrl.trim() || null,
        rateLimitRule: {
          enabled: ruleEnabled,
          blockAfter: Number(blockAfter || 5),
          windowMinutes: Number(windowMinutes || 10),
          severityThreshold,
        },
      }),
    })
    if (!r.ok) return toastApiError(r)
    toast.success('Settings saved')
    setEndpoints((prev) => prev.map((e) => (e._id === settingsEndpoint._id ? r.data.endpoint : e)))
    setSettingsOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Manage endpoints</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Endpoints</div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => load()} size="sm">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add Endpoint
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-6">Loading…</Card>
      ) : endpoints.length === 0 ? (
        <Card className="p-6">
          <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>No endpoints yet</div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">Add your first endpoint to generate an agent token.</div>
          <div className="mt-4">
            <Button variant="primary" onClick={() => setOpen(true)}>Add Endpoint</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {endpoints.map((e) => (
            <Card key={e._id} className="p-5 glow-hover">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>{e.name}</div>
                  <div className="mt-1 text-sm text-[var(--color-muted)] flex items-center gap-2">
                    <Link2 className="h-4 w-4" /> {e.url}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Badge tone={e.status === 'online' ? 'success' : 'neutral'}>{e.status}</Badge>
                    <Badge tone="neutral" className="font-mono">{e._id.slice(0, 6)}…</Badge>
                    <Badge tone="danger"><ShieldAlert className="h-3.5 w-3.5 mr-1" /> {e.threatsToday ?? 0} threats today</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelected(e._id)
                      toast.success(`Selected ${e.name} for Live Logs`)
                    }}
                  >
                    Select
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSetupEndpoint(e); setSetupOpen(true) }}>
                    Setup
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSettingsEndpoint(e)
                      setWebhookUrl(e.webhookUrl || '')
                      setRuleEnabled(e.rateLimitRule?.enabled !== false)
                      setBlockAfter(String(e.rateLimitRule?.blockAfter ?? 5))
                      setWindowMinutes(String(e.rateLimitRule?.windowMinutes ?? 10))
                      setSeverityThreshold(String(e.rateLimitRule?.severityThreshold ?? 'medium'))
                      setSettingsOpen(true)
                    }}
                  >
                    <Sliders className="h-4 w-4" />
                    Rules
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteEndpoint(e._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-3">
                <div className="text-xs text-[var(--color-muted)]">Agent token</div>
                <div className="mt-2 font-mono text-xs break-all">{e.agentToken}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={() => copy(e.agentToken)}><Copy className="h-4 w-4" /> Copy</Button>
                  <Button size="sm" onClick={() => regenerateToken(e._id)}><RefreshCcw className="h-4 w-4" /> Regenerate</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} title="Add Endpoint" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-[var(--color-muted)]">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-api" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)]">URL</div>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={createEndpoint} disabled={saving || !name.trim() || !url.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={setupOpen}
        title={setupEndpoint ? `Agent setup • ${setupEndpoint.name}` : 'Agent setup'}
        onClose={() => setSetupOpen(false)}
        className="max-w-2xl"
      >
        {!setupEndpoint ? null : (
          <div className="space-y-3">
            <div className="text-sm text-[var(--color-muted)]">Install</div>
            <pre className="rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-3 text-xs overflow-auto">
              npm install lasa-agent
            </pre>
            <div className="text-sm text-[var(--color-muted)]">Init</div>
            <pre className="rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-3 text-xs overflow-auto">
{`const lasa = require('lasa-agent');
lasa.init({ agentToken: '${setupEndpoint.agentToken}', endpointId: '${setupEndpoint._id}' });`}
            </pre>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => copy(setupEndpoint.agentToken)}><Copy className="h-4 w-4" /> Copy token</Button>
              <Button size="sm" onClick={() => copy(setupEndpoint._id)}><Copy className="h-4 w-4" /> Copy endpointId</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={settingsOpen}
        title={settingsEndpoint ? `Endpoint settings • ${settingsEndpoint.name}` : 'Endpoint settings'}
        onClose={() => setSettingsOpen(false)}
        className="max-w-2xl"
      >
        {!settingsEndpoint ? null : (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-[var(--color-muted)]">Webhook URL (optional)</div>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/..." />
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                LASA will POST threat alerts instantly to this URL.
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                    Auto-block rule
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">Block IP after X suspicious events in Y minutes.</div>
                </div>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={ruleEnabled} onChange={(e) => setRuleEnabled(e.target.checked)} />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-[var(--color-muted)]">Block after</div>
                  <Input value={blockAfter} onChange={(e) => setBlockAfter(e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-[var(--color-muted)]">Window (minutes)</div>
                  <Input value={windowMinutes} onChange={(e) => setWindowMinutes(e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-[var(--color-muted)]">Severity threshold</div>
                  <select
                    className="mt-1 w-full rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm"
                    value={severityThreshold}
                    onChange={(e) => setSeverityThreshold(e.target.value)}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveSettings}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


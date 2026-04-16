import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import { Plus, Trash2, RefreshCcw, Zap, Settings2 } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { Modal } from '@/ui/Modal'

type Rule = any

const FIELDS = ['ip', 'path', 'statusCode', 'method', 'geo.country', 'threatType', 'userAgent']
const OPERATORS = ['equals', 'contains', 'startsWith', 'endsWith', 'gt', 'lt', 'regex']
const ACTIONS = ['alert', 'block', 'log-only']
const SEVERITIES = ['low', 'medium', 'high', 'critical']

export function AlertRulesPage() {
  const { getToken } = useAuth()
  const [rules, setRules] = React.useState<Rule[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)

  // Form state
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [conditions, setConditions] = React.useState([{ field: 'ip', operator: 'equals', value: '' }])
  const [conditionLogic, setConditionLogic] = React.useState('AND')
  const [action, setAction] = React.useState('alert')
  const [severity, setSeverity] = React.useState('medium')

  const load = React.useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    const r = await apiFetch<{ rules: Rule[] }>('/alert-rules', { token })
    if (!r.ok) toastApiError(r)
    else setRules(r.data.rules)
    setLoading(false)
  }, [getToken])

  React.useEffect(() => { load().catch(() => setLoading(false)) }, [load])

  async function create() {
    if (!name.trim()) return toast.error('Name is required')
    const token = await getToken()
    const r = await apiFetch<{ rule: Rule }>('/alert-rules', {
      method: 'POST', token,
      body: JSON.stringify({ name, description, conditions, conditionLogic, action, severity }),
    })
    if (!r.ok) return toastApiError(r)
    toast.success('Rule created')
    setOpen(false)
    setRules(prev => [r.data.rule, ...prev])
    resetForm()
  }

  async function toggle(id: string, enabled: boolean) {
    const token = await getToken()
    await apiFetch<any>(`/alert-rules/${id}`, { method: 'PATCH', token, body: JSON.stringify({ enabled: !enabled }) })
    setRules(prev => prev.map(r => r._id === id ? { ...r, enabled: !enabled } : r))
  }

  async function remove(id: string) {
    if (!confirm('Delete this rule?')) return
    const token = await getToken()
    const r = await apiFetch<any>(`/alert-rules/${id}`, { method: 'DELETE', token })
    if (!r.ok) return toastApiError(r)
    toast.success('Rule deleted')
    setRules(prev => prev.filter(r => r._id !== id))
  }

  function resetForm() {
    setName('')
    setDescription('')
    setConditions([{ field: 'ip', operator: 'equals', value: '' }])
    setConditionLogic('AND')
    setAction('alert')
    setSeverity('medium')
  }

  function addCondition() {
    setConditions(prev => [...prev, { field: 'ip', operator: 'equals', value: '' }])
  }

  function removeCondition(i: number) {
    setConditions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateCondition(i: number, key: string, val: string) {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: val } : c))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Automation</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Alert Rules</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => load()}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
          <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Rule</Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-[var(--color-muted)]">Loading...</Card>
      ) : rules.length === 0 ? (
        <Card className="p-12 text-center">
          <Settings2 className="h-12 w-12 text-[var(--color-muted)] mx-auto mb-4" />
          <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>No Alert Rules</div>
          <div className="text-sm text-[var(--color-muted)] mt-2">Create custom rules to automate threat detection and response.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: Rule) => (
            <Card key={rule._id} className="p-5 glow-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{rule.name}</span>
                    <Badge tone={rule.enabled ? 'success' : 'neutral'}>{rule.enabled ? 'Active' : 'Disabled'}</Badge>
                    <Badge tone={rule.action === 'block' ? 'danger' : rule.action === 'alert' ? 'warn' : 'neutral'}>{rule.action}</Badge>
                    <Badge tone={rule.severity === 'critical' || rule.severity === 'high' ? 'danger' : rule.severity === 'medium' ? 'warn' : 'neutral'}>{rule.severity}</Badge>
                  </div>
                  {rule.description && <div className="text-xs text-[var(--color-muted)] mb-2">{rule.description}</div>}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(rule.conditions || []).map((c: any, i: number) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-[10px] text-[var(--color-cyan)] font-semibold mx-1">{rule.conditionLogic}</span>}
                        <Badge tone="cyan" className="text-[10px]">{c.field} {c.operator} "{c.value}"</Badge>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">
                    Triggered {rule.triggerCount || 0} times
                    {rule.lastTriggeredAt && ` · Last: ${new Date(rule.lastTriggeredAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => toggle(rule._id, rule.enabled)}>
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(rule._id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} title="Create Alert Rule" onClose={() => { setOpen(false); resetForm() }} className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[var(--color-muted)] mb-1">Rule Name</div>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Block Russian IPs" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)] mb-1">Description (optional)</div>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this rule do?" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[var(--color-muted)]">Conditions</div>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-2 py-1 text-xs" value={conditionLogic} onChange={e => setConditionLogic(e.target.value)}>
                  <option value="AND">Match ALL</option>
                  <option value="OR">Match ANY</option>
                </select>
                <Button size="sm" onClick={addCondition}><Plus className="h-3 w-3" /> Add</Button>
              </div>
            </div>
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <select className="rounded-lg border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-2 py-2 text-xs flex-shrink-0" value={c.field} onChange={e => updateCondition(i, 'field', e.target.value)}>
                  {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select className="rounded-lg border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-2 py-2 text-xs flex-shrink-0" value={c.operator} onChange={e => updateCondition(i, 'operator', e.target.value)}>
                  {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <Input className="flex-1 text-xs" value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} placeholder="Value..." />
                {conditions.length > 1 && (
                  <Button size="sm" variant="danger" onClick={() => removeCondition(i)}><Trash2 className="h-3 w-3" /></Button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[var(--color-muted)] mb-1">Action</div>
              <select className="w-full rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm" value={action} onChange={e => setAction(e.target.value)}>
                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)] mb-1">Severity</div>
              <select className="w-full rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm" value={severity} onChange={e => setSeverity(e.target.value)}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" onClick={create} disabled={!name.trim()}><Zap className="h-4 w-4" /> Create Rule</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import * as React from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import { Shield, Trash2, FileText, Zap } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { useAppStore } from '@/state/appStore'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'

type Me = { user: { alertPrefs: { emailEnabled: boolean; minSeverity: string }; reportPreferences?: any } }

export function SettingsPage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  const [prefs, setPrefs] = React.useState<{ emailEnabled: boolean; minSeverity: string }>({
    emailEnabled: true,
    minSeverity: 'high',
  })
  const [reportPrefs, setReportPrefs] = React.useState({
    dailyReport: true,
    weeklyReport: true,
    reportTime: '08:00',
    minRiskToEmail: 'low',
    includeRawStats: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [sendingTest, setSendingTest] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      const token = await getToken()
      const r = await apiFetch<Me>('/user/me', { token })
      if (!alive) return
      if (!r.ok) toastApiError(r)
      else {
        setPrefs(r.data.user.alertPrefs)
        if (r.data.user.reportPreferences) {
          setReportPrefs((prev) => ({ ...prev, ...r.data.user.reportPreferences }))
        }
      }
      setLoading(false)
    })().catch(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [getToken])

  async function savePrefs() {
    const token = await getToken()
    const r = await apiFetch('/user/prefs', { method: 'PATCH', token, body: JSON.stringify({ alertPrefs: prefs }) })
    if (!r.ok) return toastApiError(r)
    toast.success('Saved preferences')
  }

  async function saveReportPrefs() {
    const token = await getToken()
    const r = await apiFetch('/reports/preferences', { method: 'PUT', token, body: JSON.stringify(reportPrefs) })
    if (!r.ok) return toastApiError(r)
    toast.success('Report preferences saved')
  }

  async function sendTestReport() {
    setSendingTest(true)
    const token = await getToken()
    const r = await apiFetch<any>('/reports/generate', { method: 'POST', token, body: JSON.stringify({ period: 'manual' }) })
    if (!r.ok) toastApiError(r)
    else toast.success('Test report generation started! Check your email shortly.')
    setSendingTest(false)
  }

  async function clearData() {
    if (!confirm('Clear ALL logs/alerts/blocked IPs/audit for this account?')) return
    const token = await getToken()
    const r = await apiFetch('/user/clear', { method: 'POST', token })
    if (!r.ok) return toastApiError(r)
    toast.success('Cleared data')
  }

  async function deleteAccount() {
    if (!confirm('DELETE account and all data in LASA DB? (This does NOT delete your Clerk account)')) return
    const token = await getToken()
    const r = await apiFetch('/user/account', { method: 'DELETE', token })
    if (!r.ok) return toastApiError(r)
    toast.success('Account deleted')
    window.location.href = '/'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Preferences</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Settings</div>
        </div>
        <Button onClick={toggleTheme}>Theme: {theme}</Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[rgba(0,245,255,0.08)] border border-[rgba(0,245,255,0.14)] grid place-items-center">
            <Shield className="h-5 w-5 text-[var(--color-cyan)]" />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Profile</div>
            <div className="text-xs text-[var(--color-muted)]">From Clerk</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Name</div>
            <div className="mt-1 text-sm">{user?.fullName || '—'}</div>
          </div>
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Email</div>
            <div className="mt-1 text-sm">{user?.primaryEmailAddress?.emailAddress || '—'}</div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Alert preferences</div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">Control email alerting behavior.</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Email alerts</div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.emailEnabled}
                onChange={(e) => setPrefs((p) => ({ ...p, emailEnabled: e.target.checked }))}
              />
              Enabled
            </label>
          </div>
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Minimum severity</div>
            <select
              className="mt-2 w-full rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm"
              value={prefs.minSeverity}
              onChange={(e) => setPrefs((p) => ({ ...p, minSeverity: e.target.value }))}
              disabled={loading}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={savePrefs} disabled={loading}>
            Save
          </Button>
        </div>
      </Card>

      {/* Report Preferences */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-[var(--color-cyan)]" />
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Report Preferences</div>
        </div>
        <div className="text-sm text-[var(--color-muted)]">Configure automated security report delivery.</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Daily Report</div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reportPrefs.dailyReport}
                onChange={(e) => setReportPrefs((p) => ({ ...p, dailyReport: e.target.checked }))}
              />
              Send daily security report
            </label>
          </div>
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Weekly Report</div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reportPrefs.weeklyReport}
                onChange={(e) => setReportPrefs((p) => ({ ...p, weeklyReport: e.target.checked }))}
              />
              Send weekly security report
            </label>
          </div>
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Delivery Time (IST)</div>
            <input
              type="time"
              className="mt-2 w-full rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm"
              value={reportPrefs.reportTime}
              onChange={(e) => setReportPrefs((p) => ({ ...p, reportTime: e.target.value }))}
            />
          </div>
          <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="text-xs text-[var(--color-muted)]">Minimum risk to email</div>
            <select
              className="mt-2 w-full rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm"
              value={reportPrefs.minRiskToEmail}
              onChange={(e) => setReportPrefs((p) => ({ ...p, minRiskToEmail: e.target.value }))}
            >
              <option value="low">Low (always send)</option>
              <option value="medium">Medium+</option>
              <option value="high">High+</option>
              <option value="critical">Critical only</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button onClick={sendTestReport} disabled={sendingTest}>
            <Zap className="h-4 w-4" /> {sendingTest ? 'Generating…' : 'Send Test Report'}
          </Button>
          <Button variant="primary" onClick={saveReportPrefs} disabled={loading}>
            Save Report Preferences
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>API token</div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">
          Use your Clerk session token as a Bearer token for API calls from scripts/tools.
        </div>
        <div className="mt-3">
          <Badge tone="cyan">Authorization: Bearer &lt;Clerk token&gt;</Badge>
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-semibold text-[var(--color-danger)]" style={{ fontFamily: 'var(--font-heading)' }}>Danger zone</div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">Destructive operations require confirmation.</div>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={deleteAccount}>
            <Trash2 className="h-4 w-4" /> Delete account
          </Button>
          <Button variant="danger" onClick={clearData}>
            <Trash2 className="h-4 w-4" /> Clear all logs
          </Button>
        </div>
      </Card>
    </div>
  )
}

import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FileText, RefreshCcw, Mail, Shield, Zap } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'

type ReportRow = {
  _id: string
  generatedAt: string
  period: string
  status: string
  summary: string
  overallRiskScore: number
  riskLevel: string
  threatBreakdown: any[]
  topAttackers: any[]
  predictions: any[]
  endpointSummaries: any[]
}

function RiskGauge({ score, size = 120 }: { score: number; size?: number }) {
  const radius = size / 2 - 10
  const circumference = Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score > 75 ? '#ff2d55' : score > 50 ? '#ff8c00' : score > 25 ? '#ffb800' : '#00ff88'


  return (
    <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
      {/* Background arc */}
      <path
        d={`M ${10} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Progress arc */}
      <path
        d={`M ${10} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference}`}
        style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
      />
      {/* Score text */}
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" fill={color} fontSize="28" fontWeight="700" fontFamily="var(--font-mono)">
        {score}
      </text>
      <text x={size / 2} y={size / 2 + 15} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">
        /100
      </text>
    </svg>
  )
}

function periodBadge(p: string) {
  if (p === 'daily') return <Badge tone="cyan">Daily</Badge>
  if (p === 'weekly') return <Badge tone="success">Weekly</Badge>
  return <Badge tone="warn">Manual</Badge>
}

function riskBadge(level: string) {
  const tone = level === 'critical' || level === 'high' ? 'danger' : level === 'medium' ? 'warn' : 'success'
  return <Badge tone={tone}>{level.toUpperCase()}</Badge>
}

export function ReportsPage() {
  const { getToken } = useAuth()
  const [reports, setReports] = React.useState<ReportRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [generating, setGenerating] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    const r = await apiFetch<{ reports: ReportRow[] }>('/reports', { token, query: { limit: 50 } })
    if (!r.ok) toastApiError(r)
    else setReports(r.data.reports)
    setLoading(false)
  }, [getToken])

  React.useEffect(() => { load().catch(() => setLoading(false)) }, [load])

  async function generate() {
    setGenerating(true)
    const token = await getToken()
    const r = await apiFetch<any>('/reports/generate', { method: 'POST', token, body: JSON.stringify({ period: 'manual' }) })
    if (!r.ok) toastApiError(r)
    else toast.success('Report generation started! You\'ll be notified when ready.')
    setGenerating(false)
    // Refresh after a delay
    setTimeout(() => load().catch(() => {}), 5000)
  }

  async function resend(id: string) {
    const token = await getToken()
    const r = await apiFetch<any>(`/reports/${id}/resend`, { method: 'POST', token })
    if (!r.ok) toastApiError(r)
    else toast.success('Report email resent!')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Intelligence</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            Security Reports
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => load()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="primary" onClick={generate} disabled={generating}>
            <Zap className="h-4 w-4" /> {generating ? 'Generating...' : 'Generate Report Now'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0,1,2,3].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-1/3 mb-4" />
              <div className="h-16 bg-white/5 rounded mb-4" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-[var(--color-muted)] mx-auto mb-4" />
          <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>No Reports Yet</div>
          <div className="text-sm text-[var(--color-muted)] mt-2">Click "Generate Report Now" to create your first AI security report.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(r => (
            <Card key={r._id} className="p-5 glow-hover transition-all duration-300 hover:scale-[1.01]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {periodBadge(r.period)}
                    {riskBadge(r.riskLevel)}
                    {r.status === 'generating' && <Badge tone="warn">Generating...</Badge>}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {new Date(r.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <RiskGauge score={r.overallRiskScore} size={80} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-xs text-[var(--color-muted)]">Threats</div>
                  <div className="font-mono font-semibold text-[var(--color-danger)]">{r.threatBreakdown?.reduce((s: number, t: any) => s + t.count, 0) || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[var(--color-muted)]">Attackers</div>
                  <div className="font-mono font-semibold">{r.topAttackers?.length || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[var(--color-muted)]">Predictions</div>
                  <div className="font-mono font-semibold text-[var(--color-cyan)]">{r.predictions?.length || 0}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link to={`/dashboard/reports/${r._id}`} className="flex-1">
                  <Button variant="primary" className="w-full"><Shield className="h-4 w-4" /> View Full Report</Button>
                </Link>
                <Button size="sm" onClick={() => resend(r._id)}>
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

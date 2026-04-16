import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import { Download, ArrowLeft, Mail, TrendingUp, TrendingDown, Minus, Shield, Crosshair, Target } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'

function RiskGauge({ score, size = 160 }: { score: number; size?: number }) {
  const radius = size / 2 - 12
  const circumference = Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score > 75 ? '#ff2d55' : score > 50 ? '#ff8c00' : score > 25 ? '#ffb800' : '#00ff88'

  return (
    <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
      <path
        d={`M ${12} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"
      />
      <path
        d={`M ${12} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference}`}
        style={{ filter: `drop-shadow(0 0 8px ${color}60)`, transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" fill={color} fontSize="40" fontWeight="700" fontFamily="var(--font-mono)">
        {score}
      </text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="12">
        RISK SCORE
      </text>
    </svg>
  )
}

function trendIcon(trend: string) {
  if (trend === 'increasing') return <TrendingUp className="h-3.5 w-3.5 text-[var(--color-danger)]" />
  if (trend === 'decreasing') return <TrendingDown className="h-3.5 w-3.5 text-[var(--color-success)]" />
  return <Minus className="h-3.5 w-3.5 text-[var(--color-warn)]" />
}

function riskBadge(level: string) {
  const tone = level === 'critical' || level === 'high' ? 'danger' : level === 'medium' ? 'warn' : 'success'
  return <Badge tone={tone}>{level.toUpperCase()}</Badge>
}

export function ReportDetailPage() {
  const { id } = useParams()
  const { getToken } = useAuth()
  const [report, setReport] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const token = await getToken()
      const r = await apiFetch<{ report: any }>(`/reports/${id}`, { token })
      if (!alive) return
      if (!r.ok) toastApiError(r)
      else setReport(r.data.report)
      setLoading(false)
    })().catch(() => setLoading(false))
    return () => { alive = false }
  }, [getToken, id])

  async function download() {
    const token = await getToken()
    const base = (import.meta.env.VITE_API_URL as string | undefined) || '/api'
    const res = await fetch(`${base}/reports/${id}/download`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return toast.error('Download failed')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lasa-report-${id}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) return (
    <div className="space-y-4">
      {[0,1,2].map(i => (
        <Card key={i} className="p-6 animate-pulse">
          <div className="h-6 bg-white/5 rounded w-1/4 mb-4" />
          <div className="h-20 bg-white/5 rounded" />
        </Card>
      ))}
    </div>
  )

  if (!report) return (
    <Card className="p-12 text-center">
      <div className="text-lg font-semibold">Report not found</div>
      <Link to="/dashboard/reports"><Button className="mt-4">Back to Reports</Button></Link>
    </Card>
  )

  const hourly = report.rawStats?.hourlyDistribution || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/reports"><Button size="sm" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <div className="text-xs text-[var(--color-muted)]">Report Detail</div>
            <div className="text-xl font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Security Intelligence Report
              {riskBadge(report.riskLevel)}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-1">
              {new Date(report.generatedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={download}><Download className="h-4 w-4" /> Download</Button>
        </div>
      </div>

      {/* Risk Score */}
      <Card className="p-6 text-center">
        <RiskGauge score={report.overallRiskScore} size={200} />
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <div className="text-xs text-[var(--color-muted)]">Total Threats</div>
            <div className="text-2xl font-mono font-semibold text-[var(--color-danger)]">
              {report.threatBreakdown?.reduce((s: number, t: any) => s + t.count, 0) || 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)]">Top Attackers</div>
            <div className="text-2xl font-mono font-semibold">{report.topAttackers?.length || 0}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)]">Predictions</div>
            <div className="text-2xl font-mono font-semibold text-[var(--color-cyan)]">{report.predictions?.length || 0}</div>
          </div>
        </div>
      </Card>

      {/* Executive Summary */}
      <Card className="p-6">
        <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>📋 Executive Summary</div>
        <div className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">{report.summary}</div>
      </Card>

      {/* Threat Narrative */}
      {report.threatNarrative && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>📖 Threat Narrative</div>
          <div className="border-l-2 border-[var(--color-danger)] pl-4">
            <div className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">{report.threatNarrative}</div>
          </div>
        </Card>
      )}

      {/* Threat Timeline */}
      {hourly.length > 0 && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>📈 Threat Timeline</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly}>
                <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.96)', border: '1px solid rgba(0,245,255,0.12)', borderRadius: 12 }} />
                <Area type="monotone" dataKey="count" fill="rgba(255,45,85,0.15)" stroke="#ff2d55" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Threat Breakdown */}
      {report.threatBreakdown?.length > 0 && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>🎯 Threat Breakdown</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-muted)]">
                <tr className="border-b border-[rgba(0,245,255,0.08)]">
                  <th className="text-left font-medium px-4 py-3">Type</th>
                  <th className="text-left font-medium px-4 py-3">Count</th>
                  <th className="text-left font-medium px-4 py-3">Trend</th>
                  <th className="text-left font-medium px-4 py-3">Top IPs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,245,255,0.06)]">
                {report.threatBreakdown.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-white/2">
                    <td className="px-4 py-3 font-semibold">{t.threatType}</td>
                    <td className="px-4 py-3 font-mono text-[var(--color-danger)]">{t.count}</td>
                    <td className="px-4 py-3 flex items-center gap-1">{trendIcon(t.trend)} {t.trend}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">{(t.topIPs || []).slice(0, 3).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Top Attackers */}
      {report.topAttackers?.length > 0 && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>⚔️ Top Attackers</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-muted)]">
                <tr className="border-b border-[rgba(0,245,255,0.08)]">
                  <th className="text-left font-medium px-4 py-3">IP</th>
                  <th className="text-left font-medium px-4 py-3">Country</th>
                  <th className="text-left font-medium px-4 py-3">Attacks</th>
                  <th className="text-left font-medium px-4 py-3">Threat Types</th>
                  <th className="text-left font-medium px-4 py-3">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,245,255,0.06)]">
                {report.topAttackers.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-white/2">
                    <td className="px-4 py-3 font-mono text-xs">{a.ip}</td>
                    <td className="px-4 py-3">{a.country || '—'}</td>
                    <td className="px-4 py-3 font-mono text-[var(--color-danger)]">{a.attackCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(a.threatTypes || []).map((t: string, j: number) => (
                          <Badge key={j} tone="warn" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={a.riskScore > 75 ? 'danger' : a.riskScore > 25 ? 'warn' : 'success'}>
                        {a.riskScore}/100
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* AI Predictions */}
      {report.predictions?.length > 0 && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>🔮 AI Predictions</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.predictions.map((p: any, i: number) => (
              <div key={i} className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="font-semibold text-sm mb-2">{p.title}</div>
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${p.confidence}%`,
                          background: `linear-gradient(90deg, #00f5ff, ${p.confidence > 70 ? '#ff2d55' : '#00ff88'})`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-[var(--color-cyan)]">{p.confidence}%</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-muted)] mb-2">{p.reasoning}</div>
                <div className="text-xs text-[var(--color-success)]">✅ {p.recommendedAction}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Endpoint Health */}
      {report.endpointSummaries?.length > 0 && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>💊 Endpoint Health</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.endpointSummaries.map((ep: any, i: number) => (
              <div key={i} className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="font-semibold text-sm mb-2">{ep.endpointName}</div>
                <div className="text-3xl font-mono font-bold" style={{ color: ep.healthScore > 80 ? '#00ff88' : ep.healthScore > 50 ? '#ffb800' : '#ff2d55' }}>
                  {ep.healthScore}<span className="text-sm text-[var(--color-muted)]">/100</span>
                </div>
                <div className="mt-2 text-xs text-[var(--color-muted)]">
                  {ep.totalLogs} logs · {ep.suspiciousLogs} threats · {ep.blockedIPs} blocked
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {report.recommendations?.length > 0 && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>✅ Recommendations</div>
          <div className="space-y-3">
            {report.recommendations.map((r: string, i: number) => (
              <div key={i} className="flex gap-3 items-start text-sm">
                <div className="h-6 w-6 rounded-full bg-[rgba(0,245,255,0.10)] border border-[rgba(0,245,255,0.18)] flex items-center justify-center flex-shrink-0 text-xs font-semibold text-[var(--color-cyan)]">
                  {i + 1}
                </div>
                <div className="text-[var(--color-muted)]">{r}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

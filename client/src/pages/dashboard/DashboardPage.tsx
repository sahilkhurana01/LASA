import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import CountUp from 'react-countup'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import { Link } from 'react-router-dom'
import { FileText, Radar, Globe } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'

type StatsResponse = {
  cards: { totalLogsToday: number; threatsToday: number; blockedIps: number; activeEndpoints: number; unreadAlerts: number }
  charts: {
    hourly24: Array<{ hour: number; total: number; suspicious: number }>
    threatsByType: Array<{ _id: string; count: number }>
  }
  heatmap: Array<{ _id: { day: string; hour: number }; count: number }>
  geo: Array<{ _id: string; count: number }>
  aiSummary: any
}

function Heatmap({ data }: { data: StatsResponse['heatmap'] }) {
  const days = Array.from(new Set(data.map((d) => d._id.day))).slice(-7)
  const map = new Map(data.map((d) => [`${d._id.day}:${d._id.hour}`, d.count] as const))
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="overflow-auto">
      <div className="min-w-[900px] grid grid-cols-[140px_repeat(24,minmax(18px,1fr))] gap-1 text-xs">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[var(--color-muted)]">{h}</div>
        ))}
        {days.map((day) => (
          <React.Fragment key={day}>
            <div className="text-[var(--color-muted)]">{day}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const c = map.get(`${day}:${h}`) || 0
              const t = c / max
              const bg =
                c === 0
                  ? 'rgba(255,255,255,0.03)'
                  : `rgba(255,45,85,${0.15 + 0.55 * t})`
              return <div key={h} title={`${c} threats`} className="h-4 rounded" style={{ background: bg, border: '1px solid rgba(0,245,255,0.06)' }} />
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function MiniRiskGauge({ score }: { score: number }) {
  const color = score > 75 ? '#ff2d55' : score > 50 ? '#ff8c00' : score > 25 ? '#ffb800' : '#00ff88'
  return (
    <svg width="64" height="40" viewBox="0 0 64 40">
      <path d={`M 6 32 A 26 26 0 0 1 58 32`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M 6 32 A 26 26 0 0 1 58 32`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * (Math.PI * 26)} ${Math.PI * 26}`}
        style={{ filter: `drop-shadow(0 0 4px ${color}50)` }} />
      <text x="32" y="30" textAnchor="middle" fill={color} fontSize="14" fontWeight="700" fontFamily="var(--font-mono)">{score}</text>
    </svg>
  )
}

export function DashboardPage() {
  const { getToken } = useAuth()
  const [data, setData] = React.useState<StatsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [latestReport, setLatestReport] = React.useState<any>(null)
  const [ipSummary, setIpSummary] = React.useState<{ clean: number; suspicious: number; malicious: number; critical: number }>({ clean: 0, suspicious: 0, malicious: 0, critical: 0 })
  const [threatMap, setThreatMap] = React.useState<any[]>([])

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const token = await getToken()

      // Fetch stats, latest report, and threat map in parallel
      const [r, rep, tm] = await Promise.all([
        apiFetch<StatsResponse>('/stats', { token }),
        apiFetch<{ report: any }>('/reports/latest', { token }),
        apiFetch<{ mapData: any[] }>('/ip/threat-map', { token }),
      ])

      if (!alive) return
      if (!r.ok) toastApiError(r)
      else setData(r.data)

      if (rep.ok && rep.data.report) setLatestReport(rep.data.report)
      if (tm.ok) setThreatMap(tm.data.mapData)

      // Fetch IP risk summary from top attackers
      const atk = await apiFetch<{ attackers: any[] }>('/ip/top-attackers', { token })
      if (atk.ok && alive) {
        const summary = { clean: 0, suspicious: 0, malicious: 0, critical: 0 }
        for (const a of atk.data.attackers) {
          const level = a.lasaRiskLevel || 'clean'
          if (level in summary) (summary as any)[level]++
        }
        setIpSummary(summary)
      }

      setLoading(false)
    })().catch(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [getToken])

  const cards = data?.cards
  const hourly = data?.charts.hourly24 ?? []
  const threatsByType = (data?.charts.threatsByType ?? []).map((t) => ({ type: t._id, count: t.count }))

  function countryFlag(cc: string) {
    if (!cc || cc.length !== 2) return '🌐'
    return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">SOC Console</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            Dashboard
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/endpoints">
            <Button variant="primary">Add Endpoint</Button>
          </Link>
          <Link to="/dashboard/blocked-ips">
            <Button>Blocked IPs</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5 glow-hover">
          <div className="text-xs text-[var(--color-muted)]">Total Logs Today</div>
          <div className="mt-2 text-3xl font-semibold font-mono">
            {loading ? '—' : <CountUp end={cards?.totalLogsToday ?? 0} duration={1.1} separator="," />}
          </div>
        </Card>
        <Card className="p-5 glow-hover">
          <div className="text-xs text-[var(--color-muted)]">Threats Detected</div>
          <div className="mt-2 text-3xl font-semibold font-mono text-[var(--color-danger)]">
            {loading ? '—' : <CountUp end={cards?.threatsToday ?? 0} duration={1.1} separator="," />}
          </div>
        </Card>
        <Card className="p-5 glow-hover">
          <div className="text-xs text-[var(--color-muted)]">IPs Blocked</div>
          <div className="mt-2 text-3xl font-semibold font-mono">
            {loading ? '—' : <CountUp end={cards?.blockedIps ?? 0} duration={1.1} separator="," />}
          </div>
        </Card>
        <Card className="p-5 glow-hover">
          <div className="text-xs text-[var(--color-muted)]">Active Endpoints</div>
          <div className="mt-2 text-3xl font-semibold font-mono text-[var(--color-success)]">
            {loading ? '—' : <CountUp end={cards?.activeEndpoints ?? 0} duration={1.1} />}
          </div>
        </Card>
      </div>

      {/* New Widgets Row: Latest Report + IP Risk Summary + Threat Origins */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Latest Report Widget */}
        <Card className="p-5 glow-hover">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-[var(--color-cyan)]" />
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Latest Report</div>
          </div>
          {latestReport ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <MiniRiskGauge score={latestReport.overallRiskScore} />
                <div>
                  <Badge tone={latestReport.riskLevel === 'critical' || latestReport.riskLevel === 'high' ? 'danger' : latestReport.riskLevel === 'medium' ? 'warn' : 'success'}>
                    {latestReport.riskLevel?.toUpperCase()}
                  </Badge>
                  <div className="text-[10px] text-[var(--color-muted)] mt-1">
                    {new Date(latestReport.generatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {latestReport.predictions?.slice(0, 3).map((p: any, i: number) => (
                <div key={i} className="text-xs text-[var(--color-muted)] flex items-start gap-2 mb-1.5">
                  <span className="text-[var(--color-cyan)]">🔮</span>
                  <span className="truncate">{p.title}</span>
                  <span className="flex-shrink-0 font-mono text-[var(--color-warn)]">{p.confidence}%</span>
                </div>
              ))}
              <Link to="/dashboard/reports" className="block mt-3">
                <Button size="sm" variant="primary" className="w-full">View Reports</Button>
              </Link>
            </>
          ) : (
            <div className="text-sm text-[var(--color-muted)] py-4">
              No reports generated yet.
              <Link to="/dashboard/reports" className="text-[var(--color-cyan)] ml-1 hover:underline">Generate one →</Link>
            </div>
          )}
        </Card>

        {/* IP Risk Summary Widget */}
        <Card className="p-5 glow-hover">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="h-4 w-4 text-[var(--color-cyan)]" />
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>IP Risk Summary</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[rgba(0,255,136,0.15)] bg-[rgba(0,255,136,0.05)] p-3 text-center">
              <div className="text-2xl font-mono font-bold text-[var(--color-success)]">{ipSummary.clean}</div>
              <div className="text-[10px] text-[var(--color-muted)]">Clean</div>
            </div>
            <div className="rounded-xl border border-[rgba(255,184,0,0.15)] bg-[rgba(255,184,0,0.05)] p-3 text-center">
              <div className="text-2xl font-mono font-bold text-[var(--color-warn)]">{ipSummary.suspicious}</div>
              <div className="text-[10px] text-[var(--color-muted)]">Suspicious</div>
            </div>
            <div className="rounded-xl border border-[rgba(255,140,0,0.15)] bg-[rgba(255,140,0,0.05)] p-3 text-center">
              <div className="text-2xl font-mono font-bold" style={{ color: '#ff8c00' }}>{ipSummary.malicious}</div>
              <div className="text-[10px] text-[var(--color-muted)]">Malicious</div>
            </div>
            <div className="rounded-xl border border-[rgba(255,45,85,0.15)] bg-[rgba(255,45,85,0.05)] p-3 text-center">
              <div className="text-2xl font-mono font-bold text-[var(--color-danger)]">{ipSummary.critical}</div>
              <div className="text-[10px] text-[var(--color-muted)]">Critical</div>
            </div>
          </div>
          <Link to="/dashboard/ip-intelligence" className="block mt-3">
            <Button size="sm" className="w-full">IP Intelligence →</Button>
          </Link>
        </Card>

        {/* Mini Threat Map */}
        <Card className="p-5 glow-hover">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-[var(--color-cyan)]" />
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Attack Origins</div>
          </div>
          {threatMap.length > 0 ? (
            <div className="space-y-2">
              {threatMap.slice(0, 6).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{countryFlag(c.countryCode)}</span>
                    <span className="truncate">{c.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.attackCount / (threatMap[0]?.attackCount || 1)) * 100)}%`, background: 'linear-gradient(90deg, #ffb800, #ff2d55)' }} />
                    </div>
                    <span className="font-mono text-xs text-[var(--color-muted)]">{c.attackCount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--color-muted)] py-4">No geo data yet.</div>
          )}
          <Link to="/dashboard/ip-intelligence" className="block mt-3">
            <Button size="sm" className="w-full">Full Threat Map →</Button>
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-[var(--color-muted)]">24h</div>
              <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Logs over time</div>
            </div>
            <Badge tone="cyan">cyan=logs • red=suspicious</Badge>
          </div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourly}>
                <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.96)', border: '1px solid rgba(0,245,255,0.12)', borderRadius: 12 }} />
                <Line type="monotone" dataKey="total" stroke="#00f5ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="suspicious" stroke="#ff2d55" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-[var(--color-muted)]">24h</div>
              <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Threats by type</div>
            </div>
          </div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={threatsByType}>
                <XAxis dataKey="type" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.96)', border: '1px solid rgba(0,245,255,0.12)', borderRadius: 12 }} />
                <Bar dataKey="count" fill="#00f5ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-[var(--color-muted)]">Threat Heatmap</div>
              <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Density (7d x 24h)</div>
            </div>
          </div>
          <div className="mt-4">
            <Heatmap data={data?.heatmap ?? []} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-[var(--color-muted)]">AI Threat Summary</div>
          <div className="mt-1 text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Last 24 hours</div>
          <div className="mt-3 text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">
            {loading ? 'Generating…' : (typeof data?.aiSummary === 'string' ? data?.aiSummary : JSON.stringify(data?.aiSummary ?? {}, null, 2))}
          </div>
          <div className="mt-4 border-t border-[rgba(0,245,255,0.10)] pt-4">
            <div className="text-xs text-[var(--color-muted)]">Geo analytics (top countries)</div>
            <div className="mt-2 space-y-2">
              {(data?.geo ?? []).slice(0, 8).map((g) => (
                <div key={g._id} className="flex items-center justify-between text-sm">
                  <div>{g._id}</div>
                  <div className="font-mono">{g.count}</div>
                </div>
              ))}
              {(data?.geo ?? []).length === 0 && <div className="text-sm text-[var(--color-muted)]">No geo data yet.</div>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

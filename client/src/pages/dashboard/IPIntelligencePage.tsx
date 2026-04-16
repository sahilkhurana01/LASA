import * as React from 'react'
import { useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import { Search, Globe, Shield, Lock, Unlock, AlertTriangle, Server, Activity, ExternalLink, Copy, Ban } from 'lucide-react'

import { apiFetch, toastApiError } from '@/shared/api'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'

function countryFlag(countryCode: string | null) {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  return String.fromCodePoint(
    ...countryCode.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  )
}

function RiskGauge({ score, size = 140 }: { score: number; size?: number }) {
  const radius = size / 2 - 12
  const circumference = Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score > 75 ? '#ff2d55' : score > 50 ? '#ff8c00' : score > 25 ? '#ffb800' : '#00ff88'

  return (
    <svg width={size} height={size / 2 + 25} viewBox={`0 0 ${size} ${size / 2 + 25}`}>
      <path d={`M ${12} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${12} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${progress} ${circumference}`} style={{ filter: `drop-shadow(0 0 8px ${color}60)`, transition: 'stroke-dasharray 1s ease' }} />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fill={color} fontSize="32" fontWeight="700" fontFamily="var(--font-mono)">{score}</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">/100</text>
    </svg>
  )
}

function riskBadgeColor(level: string): 'danger' | 'warn' | 'success' | 'cyan' {
  if (level === 'critical') return 'danger'
  if (level === 'malicious') return 'danger'
  if (level === 'suspicious') return 'warn'
  return 'success'
}

type IPData = any
type Attacker = any

export function IPIntelligencePage() {
  const { getToken } = useAuth()
  const [searchIP, setSearchIP] = React.useState('')
  const [ipData, setIpData] = React.useState<IPData | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [attackers, setAttackers] = React.useState<Attacker[]>([])
  const [loadingAttackers, setLoadingAttackers] = React.useState(true)
  const [threatMap, setThreatMap] = React.useState<any[]>([])
  const [ipHistory, setIpHistory] = React.useState<any[]>([])

  // Load top attackers on mount
  React.useEffect(() => {
    (async () => {
      const token = await getToken()
      const r = await apiFetch<{ attackers: Attacker[] }>('/ip/top-attackers', { token })
      if (r.ok) setAttackers(r.data.attackers)
      setLoadingAttackers(false)

      // Also load threat map
      const m = await apiFetch<{ mapData: any[] }>('/ip/threat-map', { token })
      if (m.ok) setThreatMap(m.data.mapData)
    })().catch(() => setLoadingAttackers(false))
  }, [getToken])

  async function lookup() {
    if (!searchIP.trim()) return
    setSearching(true)
    const token = await getToken()
    const r = await apiFetch<{ ip: IPData }>(`/ip/lookup/${encodeURIComponent(searchIP.trim())}`, { token })
    if (!r.ok) toastApiError(r)
    else {
      setIpData(r.data.ip)
      // Also load history
      const h = await apiFetch<{ logs: any[] }>(`/ip/${encodeURIComponent(searchIP.trim())}/history`, { token, query: { limit: 5 } })
      if (h.ok) setIpHistory(h.data.logs)
    }
    setSearching(false)
  }

  async function blockIP(ip: string) {
    const token = await getToken()
    const r = await apiFetch<any>(`/ip/${encodeURIComponent(ip)}/block`, { method: 'POST', token })
    if (!r.ok) toastApiError(r)
    else {
      toast.success(`Blocked ${ip} on ${r.data.blocked} endpoint(s)`)
      if (ipData?.ip === ip) setIpData({ ...ipData, isBlockedByUser: true })
    }
  }

  async function unblockIP(ip: string) {
    const token = await getToken()
    const r = await apiFetch<any>(`/ip/${encodeURIComponent(ip)}/block`, { method: 'DELETE', token })
    if (!r.ok) toastApiError(r)
    else {
      toast.success(`Unblocked ${ip}`)
      if (ipData?.ip === ip) setIpData({ ...ipData, isBlockedByUser: false })
    }
  }

  async function blockAllCritical() {
    const critical = attackers.filter(a => a.lasaRiskLevel === 'critical' && !a.isBlocked)
    if (critical.length === 0) return toast('No critical IPs to block')
    if (!confirm(`Block ${critical.length} critical IPs across all endpoints?`)) return
    const token = await getToken()
    for (const a of critical) {
      await apiFetch<any>(`/ip/${encodeURIComponent(a.ip)}/block`, { method: 'POST', token })
    }
    toast.success(`Blocked ${critical.length} critical IPs`)
    // Refresh
    const r = await apiFetch<{ attackers: Attacker[] }>('/ip/top-attackers', { token })
    if (r.ok) setAttackers(r.data.attackers)
  }

  function copyIP() {
    if (ipData?.ip) navigator.clipboard.writeText(ipData.ip)
    toast.success('IP copied')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">Reconnaissance</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>IP Intelligence</div>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <Input
              className="pl-9"
              value={searchIP}
              onChange={(e) => setSearchIP(e.target.value)}
              placeholder="Look up any IP address... (e.g. 8.8.8.8)"
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
            />
          </div>
          <Button variant="primary" onClick={lookup} disabled={searching}>
            {searching ? 'Looking up...' : 'Lookup'}
          </Button>
        </div>
      </Card>

      {/* IP Lookup Result Panel */}
      {ipData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1 — Identity */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Identity</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-mono font-semibold">{ipData.ip}</span>
                  <button onClick={copyIP} className="text-[var(--color-muted)] hover:text-white"><Copy className="h-4 w-4" /></button>
                </div>
              </div>
              {ipData.isPrivate && <Badge tone="neutral">Private Network</Badge>}
            </div>

            {!ipData.isPrivate && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{countryFlag(ipData.countryCode)}</span>
                  <div>
                    <div className="font-semibold">{ipData.country || 'Unknown'}</div>
                    <div className="text-xs text-[var(--color-muted)]">{[ipData.city, ipData.region].filter(Boolean).join(', ')}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
                    <div className="text-xs text-[var(--color-muted)]">ISP</div>
                    <div className="mt-1 truncate">{ipData.isp || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
                    <div className="text-xs text-[var(--color-muted)]">Organization</div>
                    <div className="mt-1 truncate">{ipData.org || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
                    <div className="text-xs text-[var(--color-muted)]">ASN</div>
                    <div className="mt-1 truncate font-mono text-xs">{ipData.asn || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
                    <div className="text-xs text-[var(--color-muted)]">Timezone</div>
                    <div className="mt-1 truncate">{ipData.timezone || '—'}</div>
                  </div>
                </div>
                {ipData.lat && ipData.lon && (
                  <div className="text-xs text-[var(--color-muted)] font-mono">📍 {ipData.lat.toFixed(4)}, {ipData.lon.toFixed(4)}</div>
                )}
              </div>
            )}
          </Card>

          {/* Card 2 — Risk Assessment */}
          <Card className="p-5">
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">Risk Assessment</div>
            <div className="text-center mb-4">
              <RiskGauge score={ipData.lasaRiskScore} />
              <div className="mt-1">
                <Badge tone={riskBadgeColor(ipData.lasaRiskLevel)} className="text-sm px-4 py-1.5">
                  {(ipData.lasaRiskLevel || 'CLEAN').toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Abuse Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-danger)]" style={{ width: `${ipData.abuseScore || 0}%` }} />
                  </div>
                  <span className="font-mono text-xs">{ipData.abuseScore || 0}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Proxy/VPN</span>
                <Badge tone={ipData.isProxy || ipData.isVPN ? 'danger' : 'success'}>{ipData.isProxy || ipData.isVPN ? 'YES' : 'NO'}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Datacenter</span>
                <Badge tone={ipData.isHosting ? 'warn' : 'success'}>{ipData.isHosting ? 'YES' : 'NO'}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Known CVEs</span>
                <Badge tone={(ipData.cves?.length || 0) > 0 ? 'danger' : 'success'}>{ipData.cves?.length || 0}</Badge>
              </div>
            </div>
          </Card>

          {/* Card 3 — Threat Intelligence */}
          <Card className="p-5">
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-3">Threat Intelligence</div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
                  <div className="text-xs text-[var(--color-muted)]">Abuse Confidence</div>
                  <div className="text-xl font-mono font-bold text-[var(--color-danger)]">{ipData.abuseScore || 0}%</div>
                </div>
                <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
                  <div className="text-xs text-[var(--color-muted)]">Reports</div>
                  <div className="text-xl font-mono font-bold">{ipData.totalReports || 0}</div>
                </div>
                <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
                  <div className="text-xs text-[var(--color-muted)]">Last Reported</div>
                  <div className="text-sm">{ipData.lastReported ? new Date(ipData.lastReported).toLocaleDateString() : '—'}</div>
                </div>
              </div>

              {ipData.tags?.length > 0 && (
                <div>
                  <div className="text-xs text-[var(--color-muted)] mb-2">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {ipData.tags.map((t: string, i: number) => (
                      <Badge key={i} tone={t === 'tor' || t === 'scanner' ? 'danger' : t === 'vpn' ? 'warn' : 'neutral'}>{t}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {ipData.openPorts?.length > 0 && (
                <div>
                  <div className="text-xs text-[var(--color-muted)] mb-2">Open Ports</div>
                  <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-black/30 p-3 font-mono text-xs text-[var(--color-cyan)]">
                    {ipData.openPorts.join(', ')}
                  </div>
                </div>
              )}

              {ipData.cves?.length > 0 && (
                <div>
                  <div className="text-xs text-[var(--color-muted)] mb-2">Known CVEs</div>
                  <div className="space-y-1">
                    {ipData.cves.slice(0, 5).map((cve: string, i: number) => (
                      <a key={i} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-[var(--color-danger)] hover:underline">
                        <AlertTriangle className="h-3 w-3" /> {cve} <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Card 4 — LASA History */}
          <Card className="p-5">
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-3">LASA History</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3 text-center">
                <div className="text-xs text-[var(--color-muted)]">Total Requests</div>
                <div className="text-xl font-mono font-bold">{ipData.totalRequests || 0}</div>
              </div>
              <div className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3 text-center">
                <div className="text-xs text-[var(--color-muted)]">Total Threats</div>
                <div className="text-xl font-mono font-bold text-[var(--color-danger)]">{ipData.totalThreats || 0}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">First seen</span>
                <span>{ipData.firstSeenInLogs ? new Date(ipData.firstSeenInLogs).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Last seen</span>
                <span>{ipData.lastSeenInLogs ? new Date(ipData.lastSeenInLogs).toLocaleDateString() : '—'}</span>
              </div>
            </div>

            {/* Recent logs from this IP */}
            {ipHistory.length > 0 && (
              <div className="mt-4 border-t border-[rgba(0,245,255,0.08)] pt-4">
                <div className="text-xs text-[var(--color-muted)] mb-2">Recent Logs</div>
                {ipHistory.map((l: any) => (
                  <div key={l._id} className="text-xs py-1 border-b border-[rgba(0,245,255,0.04)] flex items-center gap-2">
                    <span className="text-[var(--color-muted)]">{new Date(l.timestamp).toLocaleString()}</span>
                    <span className="font-mono">{l.method}</span>
                    <span className="font-mono text-[var(--color-muted)] truncate">{l.path}</span>
                    {l.isSuspicious && <Badge tone="danger" className="text-[9px]">{l.threatType}</Badge>}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {ipData.isBlockedByUser ? (
                <Button variant="danger" className="flex-1" onClick={() => unblockIP(ipData.ip)}>
                  <Unlock className="h-4 w-4" /> Unblock
                </Button>
              ) : (
                <Button variant="danger" className="flex-1" onClick={() => blockIP(ipData.ip)}>
                  <Ban className="h-4 w-4" /> Block IP
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* World Threat Map */}
      {threatMap.length > 0 && (
        <Card className="p-5">
          <div className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>🌍 Attack Origins (7 days)</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {threatMap.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-[rgba(0,245,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3 glow-hover cursor-pointer transition"
                onClick={() => { setSearchIP(c.ips?.[0] || ''); if (c.ips?.[0]) { setSearchIP(c.ips[0]) } }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{countryFlag(c.countryCode)}</span>
                  <div>
                    <div className="text-sm font-semibold">{c.country}</div>
                    <div className="text-xs text-[var(--color-muted)]">{c.attackCount} attacks</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (c.attackCount / (threatMap[0]?.attackCount || 1)) * 100)}%`,
                      background: 'linear-gradient(90deg, #ffb800, #ff2d55)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Attackers Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgba(0,245,255,0.10)] flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Top Attackers</div>
            <div className="text-xs text-[var(--color-muted)]">Past 7 days across all endpoints</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="danger" onClick={blockAllCritical}>
              <Ban className="h-3.5 w-3.5" /> Block All Critical
            </Button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="text-xs text-[var(--color-muted)]">
              <tr className="border-b border-[rgba(0,245,255,0.08)]">
                <th className="text-left font-medium px-5 py-3">IP</th>
                <th className="text-left font-medium px-5 py-3">Country</th>
                <th className="text-left font-medium px-5 py-3">ISP</th>
                <th className="text-left font-medium px-5 py-3">Attacks</th>
                <th className="text-left font-medium px-5 py-3">Abuse</th>
                <th className="text-left font-medium px-5 py-3">Risk</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,245,255,0.06)]">
              {loadingAttackers ? (
                <tr><td colSpan={8} className="px-5 py-8 text-[var(--color-muted)]">Loading...</td></tr>
              ) : attackers.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-[var(--color-muted)]">No attacking IPs detected yet.</td></tr>
              ) : attackers.map((a) => (
                <tr
                  key={a.ip}
                  className="hover:bg-white/2 cursor-pointer"
                  onClick={() => { setSearchIP(a.ip); lookup() }}
                >
                  <td className="px-5 py-3 font-mono text-xs">{a.ip}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1">
                      {countryFlag(a.countryCode)} {a.country || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-muted)] truncate max-w-[150px]">{a.isp || '—'}</td>
                  <td className="px-5 py-3 font-mono text-[var(--color-danger)]">{a.attackCount}</td>
                  <td className="px-5 py-3 font-mono">{a.abuseScore || 0}%</td>
                  <td className="px-5 py-3">
                    <Badge tone={riskBadgeColor(a.lasaRiskLevel)}>{(a.lasaRiskLevel || 'clean').toUpperCase()}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {a.isBlocked ? <Badge tone="danger">Blocked</Badge> : <Badge tone="success">Active</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {a.isBlocked ? (
                      <Button size="sm" onClick={() => unblockIP(a.ip)}><Unlock className="h-3.5 w-3.5" /></Button>
                    ) : (
                      <Button size="sm" variant="danger" onClick={() => blockIP(a.ip)}><Ban className="h-3.5 w-3.5" /></Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

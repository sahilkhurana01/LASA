// ── Premium Security Report Email Template ─────────────────
// All inline CSS for maximum email client compatibility

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function riskColor(level) {
  const colors = { low: '#00ff88', medium: '#ffb800', high: '#ff8c00', critical: '#ff2d55' }
  return colors[level] || '#00f5ff'
}

function riskBgColor(level) {
  const colors = { low: 'rgba(0,255,136,0.15)', medium: 'rgba(255,184,0,0.15)', high: 'rgba(255,140,0,0.15)', critical: 'rgba(255,45,85,0.15)' }
  return colors[level] || 'rgba(0,245,255,0.15)'
}

function trendArrow(trend) {
  if (trend === 'increasing') return '↑'
  if (trend === 'decreasing') return '↓'
  return '→'
}

function trendColor(trend) {
  if (trend === 'increasing') return '#ff2d55'
  if (trend === 'decreasing') return '#00ff88'
  return '#ffb800'
}

function buildRiskGauge(score) {
  const filled = Math.round(score / 5) // 0-20 blocks
  const empty = 20 - filled
  const color = score > 75 ? '#ff2d55' : score > 50 ? '#ff8c00' : score > 25 ? '#ffb800' : '#00ff88'
  return `<span style="font-family:monospace;font-size:14px;letter-spacing:1px;color:${color}">${'█'.repeat(filled)}${'░'.repeat(empty)}</span> <span style="color:${color};font-weight:700;font-size:18px;">${score}/100</span>`
}

function countryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  return String.fromCodePoint(
    ...countryCode.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  )
}

export function buildReportEmailHTML({ report, stats, appUrl }) {
  const rLevel = report.riskLevel || 'low'
  const rColor = riskColor(rLevel)
  const rBg = riskBgColor(rLevel)
  const dateRange = `${new Date(stats.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(stats.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  // Threat breakdown table rows
  const threatRows = (report.threatBreakdown || []).map((t) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);color:#e0e0e0;font-size:13px;">${escapeHtml(t.threatType)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);color:#fff;font-family:monospace;font-size:14px;font-weight:600;">${t.count}</td>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);color:${trendColor(t.trend)};font-size:16px;font-weight:700;">${trendArrow(t.trend)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);">
        <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${t.trend === 'increasing' ? 'rgba(255,45,85,0.18)' : t.trend === 'decreasing' ? 'rgba(0,255,136,0.18)' : 'rgba(255,184,0,0.18)'};color:${trendColor(t.trend)};">${t.trend.toUpperCase()}</span>
      </td>
    </tr>
  `).join('')

  // Top attackers table rows
  const attackerRows = (report.topAttackers || []).slice(0, 10).map((a) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);color:#fff;font-family:monospace;font-size:12px;">${escapeHtml(a.ip)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);color:#e0e0e0;font-size:13px;">${escapeHtml(a.country || 'Unknown')}</td>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);color:#ff2d55;font-family:monospace;font-weight:600;font-size:14px;">${a.attackCount}</td>
      <td style="padding:10px 16px;border-bottom:1px solid rgba(0,245,255,0.08);">
        <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${a.riskScore > 75 ? 'rgba(255,45,85,0.18)' : a.riskScore > 50 ? 'rgba(255,140,0,0.18)' : 'rgba(255,184,0,0.18)'};color:${a.riskScore > 75 ? '#ff2d55' : a.riskScore > 50 ? '#ff8c00' : '#ffb800'};">${a.riskScore}/100</span>
      </td>
    </tr>
  `).join('')

  // Predictions
  const predictionCards = (report.predictions || []).map((p) => `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(0,245,255,0.10);border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:6px;">🔮 ${escapeHtml(p.title)}</div>
      <div style="margin-bottom:8px;">
        <div style="display:inline-block;background:rgba(0,0,0,0.3);border-radius:8px;overflow:hidden;width:200px;height:8px;">
          <div style="width:${p.confidence}%;height:100%;background:linear-gradient(90deg,#00f5ff,${p.confidence > 70 ? '#ff2d55' : '#00ff88'});border-radius:8px;"></div>
        </div>
        <span style="color:#00f5ff;font-size:12px;font-weight:600;margin-left:8px;">${p.confidence}% confidence</span>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-bottom:6px;">${escapeHtml(p.reasoning)}</div>
      <div style="font-size:12px;color:#00ff88;">✅ ${escapeHtml(p.recommendedAction)}</div>
    </div>
  `).join('')

  // Endpoint health cards
  const endpointCards = (report.endpointSummaries || []).map((ep) => `
    <div style="display:inline-block;width:calc(50% - 8px);vertical-align:top;background:rgba(255,255,255,0.03);border:1px solid rgba(0,245,255,0.10);border-radius:12px;padding:14px;margin:4px;box-sizing:border-box;">
      <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:4px;">${escapeHtml(ep.endpointName)}</div>
      <div style="font-size:24px;font-weight:700;color:${ep.healthScore > 80 ? '#00ff88' : ep.healthScore > 50 ? '#ffb800' : '#ff2d55'};margin-bottom:6px;">${ep.healthScore}<span style="font-size:12px;color:rgba(255,255,255,0.5);">/100</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,0.5);">${ep.totalLogs} logs · ${ep.suspiciousLogs} threats · ${ep.blockedIPs} blocked</div>
    </div>
  `).join('')

  // Recommendations
  const recoList = (report.recommendations || []).map((r, i) => `
    <div style="padding:8px 0;border-bottom:1px solid rgba(0,245,255,0.05);color:rgba(255,255,255,0.85);font-size:13px;">
      <span style="color:#00f5ff;font-weight:700;margin-right:8px;">${i + 1}.</span> ${escapeHtml(r)}
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LASA Security Intelligence Report</title>
</head>
<body style="margin:0;padding:0;background-color:#050709;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:680px;margin:0 auto;background-color:#0a0d12;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,rgba(0,245,255,0.08),rgba(255,45,85,0.06));padding:32px 28px;border-bottom:1px solid rgba(0,245,255,0.12);">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:11px;letter-spacing:3px;color:rgba(0,245,255,0.7);font-weight:600;text-transform:uppercase;">LASA</div>
        <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:4px;">Security Intelligence Report</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px;">📅 ${dateRange} · ${report.period.toUpperCase()} REPORT</div>
      </div>
    </div>
    <div style="margin-top:16px;">
      <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px;background:${rBg};color:${rColor};border:1px solid ${rColor}30;">
        ● RISK LEVEL: ${rLevel.toUpperCase()}
      </span>
    </div>
  </div>

  <!-- Risk Score Gauge -->
  <div style="padding:28px;text-align:center;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Overall Risk Score</div>
    <div>${buildRiskGauge(report.overallRiskScore)}</div>
    <div style="margin-top:12px;font-size:12px;color:rgba(255,255,255,0.4);">
      📊 ${stats.totalLogs} logs analyzed · 🚨 ${stats.suspiciousLogs} threats detected · 🛡️ ${stats.blockedIPs} IPs blocked
    </div>
  </div>

  <!-- Executive Summary -->
  <div style="padding:28px;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">📋 Executive Summary</div>
    <div style="font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);white-space:pre-wrap;">${escapeHtml(report.summary)}</div>
  </div>

  ${report.threatNarrative ? `
  <!-- Threat Narrative -->
  <div style="padding:28px;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">📖 Threat Narrative</div>
    <div style="background:rgba(255,45,85,0.05);border-left:3px solid #ff2d55;padding:16px 20px;border-radius:0 12px 12px 0;">
      <div style="font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);white-space:pre-wrap;">${escapeHtml(report.threatNarrative)}</div>
    </div>
  </div>
  ` : ''}

  ${threatRows ? `
  <!-- Threat Breakdown -->
  <div style="padding:28px;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">🎯 Threat Breakdown</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">Type</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">Count</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">Trend</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">Status</th>
        </tr>
      </thead>
      <tbody>${threatRows}</tbody>
    </table>
  </div>
  ` : ''}

  ${attackerRows ? `
  <!-- Top Attackers -->
  <div style="padding:28px;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">⚔️ Top Attackers</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">IP</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">Country</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">Attacks</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(0,245,255,0.15);">Risk</th>
        </tr>
      </thead>
      <tbody>${attackerRows}</tbody>
    </table>
  </div>
  ` : ''}

  ${predictionCards ? `
  <!-- AI Predictions -->
  <div style="padding:28px;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">🔮 AI Predictions</div>
    ${predictionCards}
  </div>
  ` : ''}

  ${endpointCards ? `
  <!-- Endpoint Health -->
  <div style="padding:28px;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">💊 Endpoint Health</div>
    <div>${endpointCards}</div>
  </div>
  ` : ''}

  ${recoList ? `
  <!-- Recommendations -->
  <div style="padding:28px;border-bottom:1px solid rgba(0,245,255,0.08);">
    <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">✅ Recommendations</div>
    ${recoList}
  </div>
  ` : ''}

  <!-- CTA Footer -->
  <div style="padding:28px;text-align:center;border-bottom:1px solid rgba(0,245,255,0.08);">
    <a href="${appUrl}/dashboard/reports/${report._id}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,rgba(0,245,255,0.15),rgba(0,245,255,0.25));border:1px solid rgba(0,245,255,0.3);border-radius:12px;color:#00f5ff;text-decoration:none;font-size:14px;font-weight:600;">
      📊 View Full Report in Dashboard
    </a>
  </div>

  <!-- Footer -->
  <div style="padding:28px;text-align:center;">
    <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-bottom:8px;">
      🛡️ LASA — Log Analysis & Security Alert Platform
    </div>
    <div style="font-size:10px;color:rgba(255,255,255,0.2);">
      This is an automated security report. You can manage delivery preferences in Settings.
    </div>
  </div>

</div>
</body>
</html>`
}

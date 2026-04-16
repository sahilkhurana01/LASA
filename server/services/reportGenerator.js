import fetch from 'node-fetch'
import nodemailer from 'nodemailer'

import Report from '../models/Report.js'
import Log from '../models/Log.js'
import Endpoint from '../models/Endpoint.js'
import BlockedIP from '../models/BlockedIP.js'
import User from '../models/User.js'
import IPIntelligence from '../models/IPIntelligence.js'
import { buildReportEmailHTML } from './reportEmailTemplate.js'

function safeJsonParse(text) {
  try {
    // Try to extract JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) return JSON.parse(match[1].trim())
    return JSON.parse(text)
  } catch {
    return null
  }
}

function getPeriodRange(period) {
  const now = new Date()
  const start = new Date()

  if (period === 'weekly') {
    start.setDate(start.getDate() - 7)
  } else {
    // daily or manual — last 24 hours
    start.setDate(start.getDate() - 1)
  }

  start.setHours(0, 0, 0, 0)
  return { start, end: now }
}

function getPrevPeriodRange(period) {
  const now = new Date()
  const end = new Date()
  const start = new Date()

  if (period === 'weekly') {
    end.setDate(end.getDate() - 7)
    start.setDate(start.getDate() - 14)
  } else {
    end.setDate(end.getDate() - 1)
    start.setDate(start.getDate() - 2)
  }

  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return { start, end }
}

// ── Aggregate Data ─────────────────────────────────────────
async function aggregateData(userId, period) {
  const { start, end } = getPeriodRange(period)
  const { start: prevStart, end: prevEnd } = getPrevPeriodRange(period)

  // Current period stats
  const [totalLogs, suspiciousLogs, blockedIPs] = await Promise.all([
    Log.countDocuments({ userId, timestamp: { $gte: start, $lte: end } }),
    Log.countDocuments({ userId, timestamp: { $gte: start, $lte: end }, isSuspicious: true }),
    BlockedIP.countDocuments({ userId }),
  ])

  // Previous period for comparison
  const [prevTotalLogs, prevSuspiciousLogs] = await Promise.all([
    Log.countDocuments({ userId, timestamp: { $gte: prevStart, $lte: prevEnd } }),
    Log.countDocuments({ userId, timestamp: { $gte: prevStart, $lte: prevEnd }, isSuspicious: true }),
  ])

  // Threat breakdown by type
  const threatsByType = await Log.aggregate([
    { $match: { userId, timestamp: { $gte: start, $lte: end }, threatType: { $ne: null } } },
    {
      $group: {
        _id: '$threatType',
        count: { $sum: 1 },
        ips: { $addToSet: '$ip' },
        endpointIds: { $addToSet: { $toString: '$endpointId' } },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ])

  // Previous period threat types for trend
  const prevThreatsByType = await Log.aggregate([
    { $match: { userId, timestamp: { $gte: prevStart, $lte: prevEnd }, threatType: { $ne: null } } },
    { $group: { _id: '$threatType', count: { $sum: 1 } } },
  ])
  const prevThreatMap = Object.fromEntries(prevThreatsByType.map((t) => [t._id, t.count]))

  // Top attacking IPs
  const topIPs = await Log.aggregate([
    { $match: { userId, timestamp: { $gte: start, $lte: end }, isSuspicious: true } },
    {
      $group: {
        _id: '$ip',
        attackCount: { $sum: 1 },
        threatTypes: { $addToSet: '$threatType' },
        firstSeen: { $min: '$timestamp' },
        lastSeen: { $max: '$timestamp' },
      },
    },
    { $sort: { attackCount: -1 } },
    { $limit: 20 },
  ])

  // Enrich top IPs with intel
  const topAttackers = []
  for (const ipData of topIPs) {
    const intel = await IPIntelligence.findOne({ ip: ipData._id }).lean()
    topAttackers.push({
      ip: ipData._id,
      country: intel?.country || null,
      attackCount: ipData.attackCount,
      threatTypes: ipData.threatTypes.filter(Boolean),
      firstSeen: ipData.firstSeen,
      lastSeen: ipData.lastSeen,
      riskScore: intel?.lasaRiskScore || 0,
    })
  }

  // Hourly distribution
  const hourlyDist = await Log.aggregate([
    { $match: { userId, timestamp: { $gte: start, $lte: end }, isSuspicious: true } },
    { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])

  // Endpoint health
  const endpoints = await Endpoint.find({ userId }).lean()
  const endpointSummaries = []
  for (const ep of endpoints) {
    const [epTotal, epSuspicious, epBlocked] = await Promise.all([
      Log.countDocuments({ endpointId: ep._id, timestamp: { $gte: start, $lte: end } }),
      Log.countDocuments({ endpointId: ep._id, timestamp: { $gte: start, $lte: end }, isSuspicious: true }),
      BlockedIP.countDocuments({ endpointId: ep._id }),
    ])
    const suspiciousRatio = epTotal > 0 ? epSuspicious / epTotal : 0
    const healthScore = Math.max(0, Math.round(100 - suspiciousRatio * 100 - Math.min(epBlocked * 2, 20)))
    endpointSummaries.push({
      endpointId: String(ep._id),
      endpointName: ep.name,
      totalLogs: epTotal,
      suspiciousLogs: epSuspicious,
      blockedIPs: epBlocked,
      healthScore,
    })
  }

  // Compute trends for threat breakdown
  const threatBreakdown = threatsByType.map((t) => {
    const prevCount = prevThreatMap[t._id] || 0
    let trend = 'stable'
    if (t.count > prevCount * 1.2) trend = 'increasing'
    else if (t.count < prevCount * 0.8) trend = 'decreasing'
    return {
      threatType: t._id,
      count: t.count,
      topIPs: t.ips.slice(0, 5),
      affectedEndpoints: t.endpointIds.slice(0, 5),
      trend,
    }
  })

  return {
    period,
    periodLabel: period === 'weekly' ? 'Past 7 Days' : 'Past 24 Hours',
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totalLogs,
    suspiciousLogs,
    blockedIPs,
    prevTotalLogs,
    prevSuspiciousLogs,
    logsTrend: totalLogs > prevTotalLogs ? 'increasing' : totalLogs < prevTotalLogs ? 'decreasing' : 'stable',
    threatsTrend: suspiciousLogs > prevSuspiciousLogs ? 'increasing' : suspiciousLogs < prevSuspiciousLogs ? 'decreasing' : 'stable',
    threatBreakdown,
    topAttackers,
    hourlyDistribution: hourlyDist.map((h) => ({ hour: h._id, count: h.count })),
    endpointSummaries,
  }
}

// ── AI Report Generation ───────────────────────────────────
async function generateAIReport(stats) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || 'arcee-ai/trinity-large-preview:free'

  if (!apiKey) {
    return {
      summary: 'AI analysis unavailable — no API key configured.',
      predictions: [],
      recommendations: ['Configure your OPENROUTER_API_KEY to enable AI-powered reports.'],
      overallRiskScore: 0,
      riskLevel: 'low',
      threatNarrative: 'No AI analysis available.',
    }
  }

  const systemPrompt = `You are a senior cybersecurity analyst writing an executive security report.
Analyze the following log statistics and return a JSON object with these exact fields:
{
  "summary": "3 paragraphs: overview of the security posture, key findings with specific numbers, and conclusion with outlook",
  "predictions": [{ "title": "short prediction title", "confidence": 0-100, "reasoning": "why this is predicted", "recommendedAction": "what to do" }],
  "recommendations": ["5-7 specific actionable security recommendations"],
  "overallRiskScore": 0-100,
  "riskLevel": "low"|"medium"|"high"|"critical",
  "threatNarrative": "A narrative story of attacks that occurred: specific times, IPs, patterns. Be specific, not generic. Reference actual data."
}
Base predictions on: attack frequency trends, time-of-day patterns, repeated IPs, escalating severity.
Be specific with numbers and IPs from the data. Reference actual endpoints and threat types.
Return ONLY valid JSON, no markdown.`

  const userPrompt = `Security log statistics for ${stats.periodLabel}:
${JSON.stringify(stats, null, 2)}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!res.ok) {
      console.error('AI report request failed:', res.status)
      return null
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = safeJsonParse(content.trim())
    if (!parsed) {
      console.error('AI report parse failed. Raw:', content.substring(0, 500))
      return null
    }

    return {
      summary: parsed.summary || '',
      predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      overallRiskScore: typeof parsed.overallRiskScore === 'number' ? Math.min(100, Math.max(0, parsed.overallRiskScore)) : 30,
      riskLevel: ['low', 'medium', 'high', 'critical'].includes(parsed.riskLevel) ? parsed.riskLevel : 'low',
      threatNarrative: parsed.threatNarrative || '',
    }
  } catch (err) {
    console.error('AI report error:', err)
    return null
  }
}

// ── Main Report Generation ─────────────────────────────────
export async function generateReport(userId, period = 'daily', io = null) {
  // Create report document immediately with 'generating' status
  const report = await Report.create({
    userId: String(userId),
    period,
    status: 'generating',
    generatedAt: new Date(),
  })

  try {
    // 1. Aggregate data
    const stats = await aggregateData(userId, period)

    // 2. Generate AI report
    const aiResult = await generateAIReport(stats)

    // Fallback if AI fails
    const summary = aiResult?.summary || `Security report for the ${stats.periodLabel}. Total logs: ${stats.totalLogs}, Threats detected: ${stats.suspiciousLogs}, Blocked IPs: ${stats.blockedIPs}.`
    const overallRiskScore = aiResult?.overallRiskScore ?? (stats.suspiciousLogs > 50 ? 75 : stats.suspiciousLogs > 10 ? 50 : stats.suspiciousLogs > 0 ? 25 : 5)
    const riskLevel = aiResult?.riskLevel ?? (overallRiskScore > 75 ? 'critical' : overallRiskScore > 50 ? 'high' : overallRiskScore > 25 ? 'medium' : 'low')

    // 3. Update report
    report.summary = summary
    report.threatBreakdown = stats.threatBreakdown
    report.topAttackers = stats.topAttackers
    report.predictions = aiResult?.predictions || []
    report.recommendations = aiResult?.recommendations || ['No specific recommendations at this time.']
    report.overallRiskScore = overallRiskScore
    report.riskLevel = riskLevel
    report.threatNarrative = aiResult?.threatNarrative || ''
    report.endpointSummaries = stats.endpointSummaries
    report.rawStats = stats
    report.status = 'completed'

    // 4. Build HTML email
    report.htmlContent = buildReportEmailHTML({
      report: report.toObject(),
      stats,
      appUrl: process.env.APP_URL || 'https://lasa-8unn.onrender.com',
    })

    await report.save()

    // 5. Emit socket event
    if (io) {
      io.to(`user:${userId}`).emit('report:ready', {
        reportId: report._id,
        riskLevel: report.riskLevel,
        overallRiskScore: report.overallRiskScore,
      })
    }

    return report
  } catch (err) {
    console.error('Report generation failed:', err)
    report.status = 'failed'
    report.summary = `Report generation failed: ${err.message}`
    await report.save()
    return report
  }
}

// ── Send Report Email ──────────────────────────────────────
export async function sendReportEmail(report, userEmail) {
  const host = process.env.BREVO_SMTP_HOST
  const port = Number(process.env.BREVO_SMTP_PORT || 587)
  const user = process.env.BREVO_SMTP_LOGIN
  const pass = process.env.BREVO_API_KEY
  const from = process.env.BREVO_SENDER_EMAIL

  if (!host || !user || !pass || !from || !userEmail) {
    return { ok: false, reason: 'SMTP not configured' }
  }

  const transporter = nodemailer.createTransport({
    host, port, secure: false,
    auth: { user, pass },
  })

  const riskEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }
  const subject = `${riskEmoji[report.riskLevel] || '🛡️'} LASA Security Report — Risk: ${report.riskLevel.toUpperCase()} (${report.overallRiskScore}/100)`

  try {
    await transporter.sendMail({
      from: `"LASA Security" <${from}>`,
      to: userEmail,
      subject,
      html: report.htmlContent,
      headers: {
        'X-LASA-Report': String(report._id),
        'X-LASA-Risk-Level': report.riskLevel,
      },
    })

    await Report.updateOne(
      { _id: report._id },
      { $set: { emailSentAt: new Date(), emailDelivered: true } },
    )

    return { ok: true }
  } catch (err) {
    console.error('Report email send failed:', err)
    return { ok: false, error: err.message }
  }
}

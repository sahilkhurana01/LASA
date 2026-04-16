import cron from 'node-cron'
import User from '../models/User.js'
import { generateReport, sendReportEmail } from './reportGenerator.js'

let ioRef = null

export function initScheduler(io) {
  ioRef = io

  // Daily report: 8:00 AM IST = 2:30 AM UTC (cron: '30 2 * * *')
  const dailyCron = process.env.REPORT_CRON_DAILY || '30 2 * * *'
  cron.schedule(dailyCron, () => {
    console.log('📊 [Scheduler] Running daily report generation...')
    runReportsForAllUsers('daily').catch((err) =>
      console.error('Daily report scheduler error:', err),
    )
  })

  // Weekly report: Monday 8:00 AM IST = Monday 2:30 AM UTC
  const weeklyCron = process.env.REPORT_CRON_WEEKLY || '30 2 * * 1'
  cron.schedule(weeklyCron, () => {
    console.log('📊 [Scheduler] Running weekly report generation...')
    runReportsForAllUsers('weekly').catch((err) =>
      console.error('Weekly report scheduler error:', err),
    )
  })

  console.log('⏰ Report scheduler initialized (daily: ' + dailyCron + ', weekly: ' + weeklyCron + ')')
}

async function runReportsForAllUsers(period) {
  const users = await User.find({}).lean()
  console.log(`📊 [Scheduler] Generating ${period} reports for ${users.length} users...`)

  for (let i = 0; i < users.length; i++) {
    const user = users[i]

    // Check report preferences
    const prefs = user.reportPreferences || {}
    if (period === 'daily' && prefs.dailyReport === false) continue
    if (period === 'weekly' && prefs.weeklyReport === false) continue

    try {
      // Generate report
      const report = await generateReport(user._id, period, ioRef)

      if (report.status === 'completed') {
        // Check if risk level meets minimum threshold
        const minRisk = prefs.minRiskToEmail || 'low'
        const riskRank = { low: 1, medium: 2, high: 3, critical: 4 }
        if (riskRank[report.riskLevel] >= (riskRank[minRisk] || 1)) {
          await sendReportEmail(report, user.email)
          console.log(`  ✅ ${period} report sent to ${user.email}`)
        } else {
          console.log(`  ⏭️ Skipped email for ${user.email} — risk ${report.riskLevel} below threshold ${minRisk}`)
        }
      }
    } catch (err) {
      console.error(`  ❌ Report failed for ${user.email}:`, err.message)
    }

    // Stagger by 500ms per user to avoid overwhelming APIs
    if (i < users.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log(`📊 [Scheduler] ${period} report generation complete.`)
}

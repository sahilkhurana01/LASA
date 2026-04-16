import nodemailer from 'nodemailer'

function severityRank(sev) {
  const s = String(sev || 'low').toLowerCase()
  return s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1
}

export async function sendThreatEmail({ to, endpointName, ip, threatType, severity, reason, log }) {
  const host = process.env.BREVO_SMTP_HOST
  const port = Number(process.env.BREVO_SMTP_PORT || 587)
  const user = process.env.BREVO_SMTP_LOGIN
  const pass = process.env.BREVO_API_KEY
  const from = process.env.BREVO_SENDER_EMAIL

  if (!host || !user || !pass || !from || !to) return { ok: false, skipped: true, reason: 'SMTP not configured' }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  })

  const subj = `[LASA] ${String(severity).toUpperCase()} ${threatType || 'Threat'} detected on ${endpointName}`

  const safe = (s) => String(s || '').replace(/[<>]/g, '')
  const pre = `Threat: ${safe(threatType)}\nSeverity: ${safe(severity)}\nIP: ${safe(ip)}\nReason: ${safe(reason)}\n\nLog:\n${JSON.stringify(log, null, 2)}`

  await transporter.sendMail({
    from,
    to,
    subject: subj,
    text: pre,
    headers: {
      'X-LASA-Severity': String(severity),
      'X-LASA-Severity-Rank': String(severityRank(severity)),
    },
  })

  return { ok: true }
}


/**
 * Email Service — Brevo SMTP Integration
 * Sends styled alert emails for high-risk security events
 */

import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.BREVO_SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_API_KEY,
    },
})

function generateEmailHTML(project, alert, aiReport) {
    const severityColors = {
        critical: '#EF4444',
        high: '#F59E0B',
        medium: '#FBBF24',
        low: '#10B981',
    }

    const color = severityColors[alert.severity] || '#F59E0B'

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0B0F19;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#111827,#1a2332);border:1px solid rgba(0,240,255,0.15);border-radius:16px;padding:32px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="font-size:24px;">🛡️</div>
        <div>
          <div style="color:#00F0FF;font-size:18px;font-weight:700;letter-spacing:2px;">LASA</div>
          <div style="color:#6B7280;font-size:10px;letter-spacing:3px;">SECURITY ALERT</div>
        </div>
      </div>
      
      <h1 style="color:#fff;font-size:22px;margin:0 0 8px 0;">🚨 High Risk Activity Detected</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:0;">An automated security alert has been triggered for your project.</p>
    </div>
    
    <!-- Alert Details -->
    <div style="background:linear-gradient(135deg,#111827,#1a2332);border:1px solid rgba(0,240,255,0.1);border-radius:16px;padding:24px;margin-bottom:20px;">
      <h2 style="color:#E5E7EB;font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px 0;">Alert Summary</h2>
      
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#6B7280;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Project</td>
          <td style="color:#fff;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-weight:600;">${project.name}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Attack Type</td>
          <td style="color:${color};font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-weight:600;">${alert.attackType}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Suspicious IP</td>
          <td style="color:#fff;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-family:monospace;">${alert.ip}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Severity</td>
          <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">
            <span style="background:${color}20;color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;text-transform:uppercase;">${alert.severity}</span>
          </td>
        </tr>
        <tr>
          <td style="color:#6B7280;font-size:13px;padding:8px 0;">Risk Score</td>
          <td style="color:${color};font-size:18px;padding:8px 0;text-align:right;font-weight:800;font-family:monospace;">${alert.riskScore}/100</td>
        </tr>
      </table>
    </div>
    
    <!-- AI Report Summary -->
    ${aiReport?.summary ? `
    <div style="background:linear-gradient(135deg,#111827,#1a2332);border:1px solid rgba(139,92,246,0.15);border-radius:16px;padding:24px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:14px;">🤖</span>
        <h2 style="color:#8B5CF6;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0;">AI Analysis</h2>
      </div>
      <p style="color:#D1D5DB;font-size:13px;line-height:1.6;margin:0;">${aiReport.summary.slice(0, 500)}</p>
    </div>
    ` : ''}
    
    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="http://localhost:5173/dashboard/alerts" style="display:inline-block;background:linear-gradient(135deg,#00F0FF,#3B82F6);color:#050811;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
        View on Dashboard →
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#4B5563;font-size:11px;margin:0;">LASA — Log Analyzer for Suspicious Activity</p>
      <p style="color:#374151;font-size:10px;margin:4px 0 0 0;">Powered by AI-assisted threat intelligence</p>
    </div>
  </div>
</body>
</html>`
}

export async function sendAlertEmail(project, alert, aiReport) {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'khuranasahil099@gmail.com'

    // In production, get email from Clerk user via ownerId
    // For now, use the sender email as recipient too
    const recipientEmail = senderEmail

    const mailOptions = {
        from: `"LASA Security" <${senderEmail}>`,
        to: recipientEmail,
        subject: `🚨 LASA Security Alert – ${alert.severity.toUpperCase()} Risk: ${alert.attackType} Detected`,
        html: generateEmailHTML(project, alert, aiReport),
    }

    try {
        const info = await transporter.sendMail(mailOptions)
        console.log(`📧 Alert email sent: ${info.messageId}`)
        return info
    } catch (err) {
        console.error('Email send error:', err)
        throw err
    }
}

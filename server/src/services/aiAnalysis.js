/**
 * AI Analysis Service — OpenRouter Integration
 * Generates professional incident reports for high-risk alerts
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function sanitizeLogData(log) {
    let raw = log.rawLog || JSON.stringify(log)

    // Remove sensitive data
    raw = raw.replace(/(password|passwd|pwd|token|secret|api_key|apikey|authorization)\s*[=:]\s*[^\s&;]+/gi, '$1=***REDACTED***')
    raw = raw.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer ***REDACTED***')
    raw = raw.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***EMAIL***')

    return raw
}

export async function generateAIReport(alert, log, project) {
    const apiKey = process.env.OPENROUTER_API_KEY
    const model = process.env.OPENROUTER_MODEL || 'arcee-ai/trinity-large-preview:free'

    if (!apiKey) {
        console.error('OpenRouter API key not configured')
        return null
    }

    const sanitizedLog = sanitizeLogData(log)

    const prompt = `You are a senior cybersecurity analyst. Analyze the following sanitized server log data and generate a professional incident report.

**Alert Details:**
- Attack Type: ${alert.attackType}
- Source IP: ${alert.ip}
- Risk Score: ${alert.riskScore}/100
- Severity: ${alert.severity}
- Project: ${project.name}
- Server Type: ${project.serverType}
- Timestamp: ${alert.createdAt}

**Sanitized Log Entry:**
${sanitizedLog}

**Endpoint Targeted:** ${log.endpoint}
**HTTP Method:** ${log.method}
**Status Code:** ${log.statusCode}

Generate a professional cybersecurity incident report with the following sections:
1. **Attack Classification** - Type and category of the attack
2. **Severity Explanation** - Why this severity level was assigned
3. **Impact Analysis** - Potential damage if the attack succeeds
4. **Recommended Mitigation** - Step-by-step actions to mitigate
5. **Suggested Firewall Rules** - Specific rules to block this attack
6. **Executive Summary** - A brief summary for management

Be concise, technical, and actionable. Format as a clear report.`

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://lasa.dev',
                'X-Title': 'LASA Security Platform',
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'You are a senior cybersecurity analyst specializing in intrusion detection, log analysis, and incident response. Provide professional, actionable reports.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 2000,
                temperature: 0.3,
            }),
        })

        if (!response.ok) {
            const errorData = await response.text()
            console.error('OpenRouter API error:', response.status, errorData)
            return null
        }

        const data = await response.json()
        const reportText = data.choices?.[0]?.message?.content

        if (!reportText) {
            console.error('Empty AI response')
            return null
        }

        // Parse sections from the report
        const sections = {
            classification: extractSection(reportText, 'Attack Classification'),
            severity: extractSection(reportText, 'Severity'),
            impact: extractSection(reportText, 'Impact'),
            mitigation: extractSection(reportText, 'Mitigation'),
            firewallRules: extractSection(reportText, 'Firewall'),
            summary: extractSection(reportText, 'Summary') || extractSection(reportText, 'Executive'),
            fullReport: reportText,
        }

        console.log(`✅ AI report generated for alert ${alert._id}`)
        return sections

    } catch (err) {
        console.error('AI analysis failed:', err)
        return null
    }
}

function extractSection(text, sectionName) {
    const regex = new RegExp(`\\*{0,2}\\d*\\.?\\s*${sectionName}[^*]*\\*{0,2}[:\\s]*([\\s\\S]*?)(?=\\n\\*{0,2}\\d*\\.?\\s*[A-Z]|$)`, 'i')
    const match = text.match(regex)
    return match ? match[1].trim().slice(0, 2000) : null
}

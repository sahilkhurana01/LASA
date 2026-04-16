import fetch from 'node-fetch'

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function analyzeLogWithAI(log) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || 'arcee-ai/trinity-large-preview:free'
  if (!apiKey) {
    return {
      isSuspicious: false,
      threatType: null,
      severity: 'low',
      reason: 'OPENROUTER_API_KEY missing; AI analysis skipped.',
      model,
      raw: null,
    }
  }

  const system =
    `You are a cybersecurity analyst.\n` +
    `Analyze the following HTTP log entry and return JSON ONLY in this exact shape:\n` +
    `{ "isSuspicious": boolean, "threatType": string|null, "severity": "low"|"medium"|"high"|"critical", "reason": string }\n` +
    `Threat types should be concise and specific like: "SQLi", "XSS", "Brute Force", "Path Traversal", "DDoS", "Scanner", "Anomaly".\n` +
    `If not suspicious, set threatType=null and severity="low".`

  const user = `HTTP log entry:\n${JSON.stringify(log, null, 2)}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    return {
      isSuspicious: false,
      threatType: null,
      severity: 'low',
      reason: `AI request failed (${res.status}).`,
      model,
      raw: { status: res.status, body: t },
    }
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  const parsed = typeof content === 'string' ? safeJsonParse(content.trim()) : null

  if (!parsed || typeof parsed.isSuspicious !== 'boolean') {
    return {
      isSuspicious: false,
      threatType: null,
      severity: 'low',
      reason: 'AI response could not be parsed as expected JSON.',
      model,
      raw: { content },
    }
  }

  const severity = ['low', 'medium', 'high', 'critical'].includes(parsed.severity) ? parsed.severity : 'low'

  return {
    isSuspicious: !!parsed.isSuspicious,
    threatType: parsed.threatType ?? null,
    severity,
    reason: String(parsed.reason ?? ''),
    model,
    raw: parsed,
  }
}


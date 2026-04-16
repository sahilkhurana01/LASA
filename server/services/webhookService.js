import fetch from 'node-fetch'

export async function sendThreatWebhook({ endpoint, alert, log }) {
  const url = endpoint.webhookUrl
  if (!url) return { ok: false, skipped: true, reason: 'no-webhook' }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lasa.threat',
        endpointId: String(endpoint._id),
        endpointName: endpoint.name,
        at: new Date().toISOString(),
        alert,
        log,
      }),
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) }
  }
}


/**
 * LASA Express Middleware (CommonJS)
 * 
 * Drop this file into ANY Express.js project to send all HTTP traffic
 * to your LASA Security Platform for AI threat analysis.
 * 
 * Usage in your app.js / server.js:
 * 
 *   const lasaMonitor = require('./lasa-middleware-cjs');
 *   app.use(lasaMonitor);
 * 
 * Environment variables (set in Render dashboard → Environment):
 *   LASA_SERVER_URL  = https://lasa-server-XXXX.onrender.com
 *   LASA_AGENT_TOKEN = eyJhbG... (from LASA Dashboard → Endpoints → copy token)
 */

const LASA_SERVER = process.env.LASA_SERVER_URL || 'http://localhost:5000';
const AGENT_TOKEN = process.env.LASA_AGENT_TOKEN || '';

let logBuffer = [];
let endpointIdCache = null;

function getEndpointId() {
  if (endpointIdCache) return endpointIdCache;
  if (!AGENT_TOKEN) return null;
  try {
    const payload = JSON.parse(Buffer.from(AGENT_TOKEN.split('.')[1], 'base64').toString());
    endpointIdCache = payload.endpointId;
    return endpointIdCache;
  } catch {
    return null;
  }
}

async function flushLogs() {
  if (logBuffer.length === 0) return;

  const endpointId = getEndpointId();
  if (!endpointId || !AGENT_TOKEN) {
    console.warn('[LASA] ⚠️ LASA_AGENT_TOKEN not set — skipping log send');
    logBuffer = [];
    return;
  }

  const batch = logBuffer.splice(0, logBuffer.length);

  try {
    const res = await fetch(`${LASA_SERVER}/api/ingest/${endpointId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({ logs: batch }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[LASA] ✅ Sent ${batch.length} logs → ${data.processed} processed`);
    } else {
      console.warn(`[LASA] ⚠️ Server returned ${res.status}`);
    }
  } catch (err) {
    console.error(`[LASA] ❌ ${err.message}`);
  }
}

// Flush every 5 seconds
setInterval(flushLogs, 5000);

function lasaMonitor(req, res, next) {
  const startTime = Date.now();

  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip']
      || req.ip
      || req.socket?.remoteAddress
      || 'unknown';

    logBuffer.push({
      ip,
      method: req.method,
      path: req.originalUrl || req.url || '/',
      statusCode: res.statusCode,
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString(),
      rawLog: `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`,
    });

    if (logBuffer.length >= 20) flushLogs().catch(() => {});

    originalEnd.apply(this, args);
  };

  next();
}

module.exports = lasaMonitor;

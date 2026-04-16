/**
 * LASA Express Middleware
 * 
 * Drop this file into ANY Express.js project to send all HTTP traffic
 * to your LASA Security Platform for AI threat analysis.
 * 
 * Usage:
 *   const lasaMonitor = require('./lasa-middleware');
 *   app.use(lasaMonitor);
 * 
 *   // OR with ES modules:
 *   import lasaMonitor from './lasa-middleware.js';
 *   app.use(lasaMonitor);
 * 
 * Environment variables (set in Render dashboard):
 *   LASA_SERVER_URL  = https://your-lasa-server.onrender.com
 *   LASA_AGENT_TOKEN = eyJhbG... (from LASA Dashboard → Endpoints → copy token)
 *   LASA_ENDPOINT_ID = 69e1239b... (from LASA Dashboard → Endpoints → copy ID)
 */

const LASA_SERVER = process.env.LASA_SERVER_URL || 'http://localhost:5000';
const AGENT_TOKEN = process.env.LASA_AGENT_TOKEN || '';
const ENDPOINT_ID = process.env.LASA_ENDPOINT_ID || '';

let logBuffer = [];
let flushTimer = null;

// Flush logs to LASA every 5 seconds
async function flushLogs() {
  if (logBuffer.length === 0) return;

  const batch = logBuffer.splice(0, logBuffer.length);
  
  // Determine endpoint ID from token if not set explicitly
  let endpointId = ENDPOINT_ID;
  if (!endpointId && AGENT_TOKEN) {
    try {
      const payload = JSON.parse(Buffer.from(AGENT_TOKEN.split('.')[1], 'base64').toString());
      endpointId = payload.endpointId;
    } catch {}
  }

  if (!endpointId || !AGENT_TOKEN) {
    console.warn('[LASA] Missing LASA_AGENT_TOKEN or LASA_ENDPOINT_ID — skipping');
    return;
  }

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
      console.warn(`[LASA] ⚠️ API returned ${res.status}`);
      // Put logs back if failed
      logBuffer.unshift(...batch);
    }
  } catch (err) {
    console.error(`[LASA] ❌ Failed to send logs: ${err.message}`);
    // Put logs back — they'll retry on next flush
    logBuffer.unshift(...batch.slice(0, 100)); // Cap to prevent memory leak
  }
}

// Start periodic flushing
if (!flushTimer) {
  flushTimer = setInterval(flushLogs, 5000);
}

/**
 * Express middleware — captures every request and queues it for LASA analysis.
 * Zero performance impact on your app (async, non-blocking).
 */
function lasaMonitor(req, res, next) {
  const startTime = Date.now();

  // Capture when response finishes
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;

    // Extract real client IP (handles proxies/load balancers)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket?.remoteAddress
      || req.ip
      || 'unknown';

    logBuffer.push({
      ip,
      method: req.method,
      path: req.originalUrl || req.url || '/',
      statusCode: res.statusCode,
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString(),
      rawLog: `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms from ${ip}`,
    });

    // If buffer is large, flush immediately
    if (logBuffer.length >= 20) {
      flushLogs().catch(() => {});
    }

    originalEnd.apply(this, args);
  };

  next();
}

// Support both CommonJS and ES modules
export default lasaMonitor;

import axios from 'axios'
import IPIntelligence from '../models/IPIntelligence.js'

// ── Rate Limiting ──────────────────────────────────────────
const IP_API_WINDOW = 60_000 // 1 minute
const IP_API_MAX = 40 // stay under 45/min limit
let ipApiCallsThisWindow = 0
let ipApiWindowStart = Date.now()

let abuseIPDBCallsToday = 0
let abuseIPDBDayStart = new Date().setHours(0,0,0,0)

function checkIpApiRateLimit() {
  const now = Date.now()
  if (now - ipApiWindowStart > IP_API_WINDOW) {
    ipApiWindowStart = now
    ipApiCallsThisWindow = 0
  }
  if (ipApiCallsThisWindow >= IP_API_MAX) return false
  ipApiCallsThisWindow++
  return true
}

function checkAbuseIPDBRateLimit() {
  const today = new Date().setHours(0,0,0,0)
  if (today !== abuseIPDBDayStart) {
    abuseIPDBDayStart = today
    abuseIPDBCallsToday = 0
  }
  if (abuseIPDBCallsToday >= 950) return false // stay under 1000/day
  abuseIPDBCallsToday++
  return true
}

// ── Private IP Detection ───────────────────────────────────
function isPrivateIP(ip) {
  if (!ip) return true
  if (ip === '::1' || ip === 'localhost' || ip === 'unknown') return true
  if (ip.startsWith('127.')) return true
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  if (ip.startsWith('169.254.')) return true
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true
  return false
}

// ── Risk Score Calculation ─────────────────────────────────
function calculateRiskScore(data) {
  let score = 0

  // 35% weight: community abuse reports
  score += (data.abuseScore || 0) * 0.35

  // 20 points: anonymization tools
  if (data.isProxy || data.isVPN) score += 20

  // 10 points: datacenter IP
  if (data.isHosting) score += 10

  // 15 points: known vulnerabilities
  if (data.cves && data.cves.length > 0) score += 15

  // 15 points: known scanner
  if (data.tags && data.tags.includes('scanner')) score += 15

  // 20 points: Tor exit node
  if (data.tags && data.tags.includes('tor')) score += 20

  // up to 15 points: LASA history
  score += Math.min((data.totalThreats || 0) * 2, 15)

  // Reduce score for false positives
  if (data.falsePositiveCount >= 3) score -= 20

  // Cap at 100
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Assign risk level
  let level = 'clean'
  if (score > 75) level = 'critical'
  else if (score > 50) level = 'malicious'
  else if (score > 25) level = 'suspicious'

  return { score, level }
}

// ── Data Source Fetchers ───────────────────────────────────
async function fetchIpApi(ip) {
  if (!checkIpApiRateLimit()) return null
  try {
    const { data } = await axios.get(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`,
      { timeout: 5000 },
    )
    if (data?.status !== 'success') return null
    return {
      country: data.country || null,
      countryCode: data.countryCode || null,
      region: data.regionName || null,
      city: data.city || null,
      lat: data.lat || null,
      lon: data.lon || null,
      timezone: data.timezone || null,
      isp: data.isp || null,
      org: data.org || null,
      asn: data.as || null,
      isProxy: !!data.proxy,
      isVPN: !!data.proxy, // ip-api merges VPN/proxy into 'proxy' field
      isHosting: !!data.hosting,
      isMobile: !!data.mobile,
    }
  } catch {
    return null
  }
}

async function fetchAbuseIPDB(ip) {
  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey || !checkAbuseIPDBRateLimit()) return null
  try {
    const { data } = await axios.get('https://api.abuseipdb.com/api/v2/check', {
      params: { ipAddress: ip, maxAgeInDays: 90, verbose: true },
      headers: { Key: apiKey, Accept: 'application/json' },
      timeout: 8000,
    })
    const d = data?.data
    if (!d) return null
    return {
      abuseScore: d.abuseConfidenceScore || 0,
      totalReports: d.totalReports || 0,
      lastReported: d.lastReportedAt ? new Date(d.lastReportedAt) : null,
      usageType: d.usageType || null,
      isWhitelisted: !!d.isWhitelisted,
    }
  } catch {
    return null
  }
}

async function fetchShodan(ip) {
  try {
    const { data } = await axios.get(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
      timeout: 5000,
    })
    if (data?.detail === 'No information available') return { openPorts: [], cves: [], hostnames: [], tags: [] }
    return {
      openPorts: Array.isArray(data.ports) ? data.ports : [],
      cves: Array.isArray(data.vulns) ? data.vulns : [],
      hostnames: Array.isArray(data.hostnames) ? data.hostnames : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
    }
  } catch {
    return null
  }
}

// ── Main Enrichment Function ───────────────────────────────
export async function enrichIP(ip) {
  if (!ip) return null

  // Handle private IPs
  if (isPrivateIP(ip)) {
    const existing = await IPIntelligence.findOne({ ip }).lean()
    if (existing) return existing

    const doc = await IPIntelligence.findOneAndUpdate(
      { ip },
      {
        ip,
        isPrivate: true,
        lasaRiskScore: 0,
        lasaRiskLevel: 'clean',
        cachedAt: new Date(),
      },
      { upsert: true, new: true },
    )
    return doc.toObject ? doc.toObject() : doc
  }

  // Check cache (< 24 hours old)
  const cached = await IPIntelligence.findOne({ ip }).lean()
  if (cached && cached.cachedAt) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age < 24 * 60 * 60 * 1000) {
      // Update lookup metadata
      await IPIntelligence.updateOne(
        { ip },
        { $set: { lastLookedUp: new Date() }, $inc: { lookupCount: 1 } },
      )
      return cached
    }
  }

  // Fetch from all sources in parallel (graceful degradation)
  const [ipApiData, abuseData, shodanData] = await Promise.all([
    fetchIpApi(ip),
    fetchAbuseIPDB(ip),
    fetchShodan(ip),
  ])

  // Merge data
  const merged = {
    ip,
    // ip-api data
    country: ipApiData?.country || cached?.country || null,
    countryCode: ipApiData?.countryCode || cached?.countryCode || null,
    region: ipApiData?.region || cached?.region || null,
    city: ipApiData?.city || cached?.city || null,
    lat: ipApiData?.lat ?? cached?.lat ?? null,
    lon: ipApiData?.lon ?? cached?.lon ?? null,
    timezone: ipApiData?.timezone || cached?.timezone || null,
    isp: ipApiData?.isp || cached?.isp || null,
    org: ipApiData?.org || cached?.org || null,
    asn: ipApiData?.asn || cached?.asn || null,
    isProxy: ipApiData?.isProxy ?? cached?.isProxy ?? false,
    isVPN: ipApiData?.isVPN ?? cached?.isVPN ?? false,
    isHosting: ipApiData?.isHosting ?? cached?.isHosting ?? false,
    isMobile: ipApiData?.isMobile ?? cached?.isMobile ?? false,

    // AbuseIPDB data
    abuseScore: abuseData?.abuseScore ?? cached?.abuseScore ?? 0,
    totalReports: abuseData?.totalReports ?? cached?.totalReports ?? 0,
    lastReported: abuseData?.lastReported || cached?.lastReported || null,
    usageType: abuseData?.usageType || cached?.usageType || null,

    // Shodan data
    openPorts: shodanData?.openPorts || cached?.openPorts || [],
    cves: shodanData?.cves || cached?.cves || [],
    hostnames: shodanData?.hostnames || cached?.hostnames || [],
    tags: shodanData?.tags || cached?.tags || [],

    // Preserve LASA internal data
    firstSeenInLogs: cached?.firstSeenInLogs || null,
    lastSeenInLogs: cached?.lastSeenInLogs || null,
    totalRequests: cached?.totalRequests || 0,
    totalThreats: cached?.totalThreats || 0,
    isBlockedByUser: cached?.isBlockedByUser || false,
    falsePositiveCount: cached?.falsePositiveCount || 0,
    isWhitelisted: cached?.isWhitelisted || false,
    isPrivate: false,

    // Meta
    lastLookedUp: new Date(),
    lookupCount: (cached?.lookupCount || 0) + 1,
    cachedAt: new Date(),
  }

  // Calculate risk score
  const { score, level } = calculateRiskScore(merged)
  merged.lasaRiskScore = score
  merged.lasaRiskLevel = level

  // Upsert to MongoDB
  const doc = await IPIntelligence.findOneAndUpdate(
    { ip },
    { $set: merged },
    { upsert: true, new: true },
  )

  return doc.toObject ? doc.toObject() : doc
}

// ── Update LASA Internal Stats ─────────────────────────────
export async function updateIPStats(ip, { isSuspicious = false } = {}) {
  if (!ip || isPrivateIP(ip)) return
  const update = {
    $set: { lastSeenInLogs: new Date() },
    $inc: { totalRequests: 1 },
  }
  if (isSuspicious) {
    update.$inc.totalThreats = 1
  }
  // Also set firstSeenInLogs if not set
  await IPIntelligence.updateOne(
    { ip },
    {
      ...update,
      $setOnInsert: { ip, firstSeenInLogs: new Date(), cachedAt: null },
    },
    { upsert: true },
  )
}

// ── Batch Enrichment with Rate Limiting ────────────────────
export async function batchEnrichIPs(ips) {
  const unique = [...new Set(ips)].filter(Boolean)
  const results = []

  // Use dynamic import for p-limit (ESM)
  const pLimit = (await import('p-limit')).default
  const limit = pLimit(5) // max 5 concurrent requests

  const tasks = unique.map((ip) =>
    limit(async () => {
      try {
        const result = await enrichIP(ip)
        results.push(result)
      } catch {
        results.push({ ip, error: true })
      }
    }),
  )

  await Promise.all(tasks)
  return results
}

// ── In-Memory Enrichment Queue ─────────────────────────────
const enrichmentQueue = []
let queueProcessing = false

export function queueIPEnrichment(ip) {
  if (!ip || isPrivateIP(ip)) return
  if (enrichmentQueue.includes(ip)) return
  if (enrichmentQueue.length > 500) enrichmentQueue.shift() // prevent memory leak
  enrichmentQueue.push(ip)
}

async function processEnrichmentQueue() {
  if (queueProcessing || enrichmentQueue.length === 0) return
  queueProcessing = true

  try {
    const batch = enrichmentQueue.splice(0, 5)
    for (const ip of batch) {
      try {
        await enrichIP(ip)
      } catch {
        // Silently fail, will retry later
      }
      // Small delay between lookups
      await new Promise((r) => setTimeout(r, 200))
    }
  } finally {
    queueProcessing = false
  }
}

// Process queue every 3 seconds
setInterval(processEnrichmentQueue, 3000)

export { isPrivateIP, calculateRiskScore }

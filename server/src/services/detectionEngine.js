/**
 * LASA Detection Engine
 * Rule-based threat detection for server logs
 */

// ============ SQL INJECTION PATTERNS ============
const SQL_PATTERNS = [
    /(\b(union)\b\s+\b(select|all)\b)/i,
    /(\bor\b\s+\d+\s*=\s*\d+)/i,
    /(;\s*(drop|delete|update|insert|alter|create)\s)/i,
    /('(\s|%20)*(or|and)(\s|%20)*'?\d+(\s|%20)*=(\s|%20)*\d+)/i,
    /(--(\s|%20)*$)/i,
    /(\b(select|insert|update|delete|drop|alter|create|exec|execute)\b.*\b(from|into|table|database)\b)/i,
    /(\/\*.*\*\/)/i,
    /(%27|%22|%2D%2D)/i,
    /(xp_cmdshell|sp_executesql)/i,
    /(benchmark\s*\(|sleep\s*\(|waitfor\s+delay)/i,
]

// ============ XSS PATTERNS ============
const XSS_PATTERNS = [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /(on(error|load|click|mouseover|focus|blur|submit|change|input)\s*=)/i,
    /<iframe[\s>]/i,
    /<img[^>]+\bon\w+\s*=/i,
    /(alert|confirm|prompt)\s*\(/i,
    /document\.(cookie|domain|location)/i,
    /(eval|setTimeout|setInterval)\s*\(/i,
    /<svg[\s>].*on\w+\s*=/i,
    /(<[^>]+(href|src)\s*=\s*['"]*javascript)/i,
]

// ============ ADMIN ABUSE PATTERNS ============
const ADMIN_ENDPOINTS = [
    /\/admin/i,
    /\/wp-admin/i,
    /\/administrator/i,
    /\/phpmyadmin/i,
    /\/dashboard\/admin/i,
    /\/panel/i,
    /\/cpanel/i,
    /\/console/i,
    /\/manager/i,
]

// ============ IN-MEMORY TRACKING ============
const ipTracker = new Map() // ip -> { loginAttempts: [{ts}], requestCount: [{ts}] }

function cleanOldEntries(entries, windowMs) {
    const cutoff = Date.now() - windowMs
    return entries.filter(e => e.ts > cutoff)
}

function getIPStats(ip) {
    if (!ipTracker.has(ip)) {
        ipTracker.set(ip, { loginAttempts: [], requests: [], adminAccesses: [] })
    }
    return ipTracker.get(ip)
}

// ============ DETECTION FUNCTIONS ============

function detectSQLInjection(entry) {
    const detections = []
    const haystack = `${entry.endpoint || ''} ${entry.rawLog || ''} ${entry.url || ''}`

    for (const pattern of SQL_PATTERNS) {
        if (pattern.test(haystack)) {
            detections.push({
                type: 'SQL Injection',
                detail: `SQL injection pattern detected: ${pattern.toString().slice(1, 40)}...`,
                confidence: 0.85,
                baseScore: 40,
            })
            break // one match is enough
        }
    }

    return detections
}

function detectXSS(entry) {
    const detections = []
    const haystack = `${entry.endpoint || ''} ${entry.rawLog || ''} ${entry.url || ''}`

    for (const pattern of XSS_PATTERNS) {
        if (pattern.test(haystack)) {
            detections.push({
                type: 'XSS',
                detail: `XSS pattern detected in request payload`,
                confidence: 0.8,
                baseScore: 35,
            })
            break
        }
    }

    return detections
}

function detectBruteForce(entry) {
    const detections = []
    const ip = entry.ip

    if (!ip) return detections

    const stats = getIPStats(ip)

    // Track failed logins
    if (entry.statusCode === 401 || entry.statusCode === 403) {
        const isLoginEndpoint = /\/(login|auth|signin|sign-in|authenticate)/i.test(entry.endpoint || '')
        if (isLoginEndpoint) {
            stats.loginAttempts.push({ ts: Date.now() })
        }
    }

    // Clean old entries (1-minute window)
    stats.loginAttempts = cleanOldEntries(stats.loginAttempts, 60000)

    if (stats.loginAttempts.length >= 5) {
        detections.push({
            type: 'Brute Force',
            detail: `${stats.loginAttempts.length} failed login attempts in last 60 seconds from IP ${ip}`,
            confidence: 0.9,
            baseScore: 45,
        })
    }

    return detections
}

function detectRateAbuse(entry) {
    const detections = []
    const ip = entry.ip

    if (!ip) return detections

    const stats = getIPStats(ip)
    stats.requests.push({ ts: Date.now() })
    stats.requests = cleanOldEntries(stats.requests, 60000) // 1-minute window

    if (stats.requests.length > 100) {
        detections.push({
            type: 'Rate Abuse',
            detail: `${stats.requests.length} requests in last 60 seconds from IP ${ip}`,
            confidence: 0.75,
            baseScore: 30,
        })
    }

    return detections
}

function detectAdminAbuse(entry) {
    const detections = []
    const endpoint = entry.endpoint || ''
    const ip = entry.ip

    if (!ip) return detections

    const isAdmin = ADMIN_ENDPOINTS.some(p => p.test(endpoint))

    if (isAdmin) {
        const stats = getIPStats(ip)
        stats.adminAccesses.push({ ts: Date.now() })
        stats.adminAccesses = cleanOldEntries(stats.adminAccesses, 300000) // 5-minute window

        if (stats.adminAccesses.length >= 5) {
            detections.push({
                type: 'Admin Abuse',
                detail: `${stats.adminAccesses.length} admin endpoint access attempts in 5 minutes from IP ${ip}`,
                confidence: 0.7,
                baseScore: 25,
            })
        }
    }

    return detections
}

// ============ MAIN DETECTION ============

export function runDetection(entry) {
    const allDetections = [
        ...detectSQLInjection(entry),
        ...detectXSS(entry),
        ...detectBruteForce(entry),
        ...detectRateAbuse(entry),
        ...detectAdminAbuse(entry),
    ]

    // Sort by base score descending
    return allDetections.sort((a, b) => b.baseScore - a.baseScore)
}

// ============ RISK SCORING ============

export function calculateRiskScore(detections, entry) {
    if (detections.length === 0) return Math.floor(Math.random() * 15) // base noise

    let score = 0

    // Sum base scores
    for (const d of detections) {
        score += d.baseScore
    }

    // Frequency multiplier
    const ip = entry.ip
    if (ip) {
        const stats = getIPStats(ip)
        const totalActivity = stats.loginAttempts.length + stats.requests.length + stats.adminAccesses.length
        if (totalActivity > 50) score *= 1.3
        else if (totalActivity > 20) score *= 1.15
    }

    // Multiple attack type bonus
    const types = new Set(detections.map(d => d.type))
    if (types.size > 1) score *= 1.2

    // Failed status code bonus
    if (entry.statusCode >= 400) score += 10

    return Math.min(100, Math.max(0, Math.round(score)))
}

// ============ SEVERITY MAPPING ============

export function getSeverity(riskScore) {
    if (riskScore >= 90) return 'critical'
    if (riskScore >= 75) return 'high'
    if (riskScore >= 50) return 'medium'
    return 'low'
}

// Cleanup old IP tracking data periodically
setInterval(() => {
    const cutoff = Date.now() - 600000 // 10 minutes
    for (const [ip, stats] of ipTracker.entries()) {
        stats.loginAttempts = cleanOldEntries(stats.loginAttempts, 600000)
        stats.requests = cleanOldEntries(stats.requests, 600000)
        stats.adminAccesses = cleanOldEntries(stats.adminAccesses, 600000)

        if (stats.loginAttempts.length === 0 && stats.requests.length === 0 && stats.adminAccesses.length === 0) {
            ipTracker.delete(ip)
        }
    }
}, 300000) // every 5 minutes

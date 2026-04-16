import mongoose from 'mongoose'

const IPIntelligenceSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },

    // Geolocation (from ip-api.com)
    country: { type: String, default: null },
    countryCode: { type: String, default: null },
    region: { type: String, default: null },
    city: { type: String, default: null },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    timezone: { type: String, default: null },
    isp: { type: String, default: null },
    org: { type: String, default: null },
    asn: { type: String, default: null },
    isProxy: { type: Boolean, default: false },
    isVPN: { type: Boolean, default: false },
    isHosting: { type: Boolean, default: false },
    isMobile: { type: Boolean, default: false },

    // Abuse data (from AbuseIPDB)
    abuseScore: { type: Number, default: 0 },
    totalReports: { type: Number, default: 0 },
    lastReported: { type: Date, default: null },
    usageType: { type: String, default: null },

    // Shodan data
    openPorts: [{ type: Number }],
    cves: [{ type: String }],
    hostnames: [{ type: String }],
    tags: [{ type: String }],

    // LASA internal data
    lasaRiskScore: { type: Number, default: 0 },
    lasaRiskLevel: { type: String, default: 'clean', enum: ['clean', 'suspicious', 'malicious', 'critical'] },
    firstSeenInLogs: { type: Date, default: null },
    lastSeenInLogs: { type: Date, default: null },
    totalRequests: { type: Number, default: 0 },
    totalThreats: { type: Number, default: 0 },
    isBlockedByUser: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },

    // False positive tracking
    falsePositiveCount: { type: Number, default: 0 },
    isWhitelisted: { type: Boolean, default: false },

    // Meta
    lastLookedUp: { type: Date, default: null },
    lookupCount: { type: Number, default: 0 },
    cachedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

IPIntelligenceSchema.index({ lasaRiskScore: -1 })
IPIntelligenceSchema.index({ cachedAt: 1 })
IPIntelligenceSchema.index({ country: 1 })

export default mongoose.model('IPIntelligence', IPIntelligenceSchema)

import mongoose from 'mongoose'

const ThreatBreakdownSchema = new mongoose.Schema(
  {
    threatType: { type: String, required: true },
    count: { type: Number, default: 0 },
    topIPs: [{ type: String }],
    affectedEndpoints: [{ type: String }],
    trend: { type: String, default: 'stable', enum: ['increasing', 'stable', 'decreasing'] },
  },
  { _id: false },
)

const TopAttackerSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true },
    country: { type: String, default: null },
    attackCount: { type: Number, default: 0 },
    threatTypes: [{ type: String }],
    firstSeen: { type: Date, default: null },
    lastSeen: { type: Date, default: null },
    riskScore: { type: Number, default: 0 },
  },
  { _id: false },
)

const PredictionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    confidence: { type: Number, default: 0 },
    reasoning: { type: String, default: '' },
    recommendedAction: { type: String, default: '' },
  },
  { _id: false },
)

const EndpointSummarySchema = new mongoose.Schema(
  {
    endpointId: { type: String, required: true },
    endpointName: { type: String, default: '' },
    totalLogs: { type: Number, default: 0 },
    suspiciousLogs: { type: Number, default: 0 },
    blockedIPs: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100 },
  },
  { _id: false },
)

const ReportSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    period: { type: String, default: 'daily', enum: ['daily', 'weekly', 'manual'] },
    status: { type: String, default: 'generating', enum: ['generating', 'completed', 'failed'] },

    summary: { type: String, default: '' },
    threatBreakdown: [ThreatBreakdownSchema],
    topAttackers: [TopAttackerSchema],
    predictions: [PredictionSchema],
    recommendations: [{ type: String }],
    overallRiskScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: 'low', enum: ['low', 'medium', 'high', 'critical'] },
    threatNarrative: { type: String, default: '' },
    endpointSummaries: [EndpointSummarySchema],

    // Raw stats used for the report
    rawStats: { type: mongoose.Schema.Types.Mixed, default: null },

    // HTML email rendering
    htmlContent: { type: String, default: '' },
    emailSentAt: { type: Date, default: null },
    emailDelivered: { type: Boolean, default: false },
  },
  { timestamps: true },
)

ReportSchema.index({ userId: 1, generatedAt: -1 })
ReportSchema.index({ userId: 1, period: 1 })

export default mongoose.model('Report', ReportSchema)

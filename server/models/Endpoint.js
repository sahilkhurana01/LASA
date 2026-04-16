import mongoose from 'mongoose'

const RateLimitRuleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    blockAfter: { type: Number, default: 5 },
    windowMinutes: { type: Number, default: 10 },
    severityThreshold: { type: String, default: 'medium', enum: ['low', 'medium', 'high', 'critical'] },
  },
  { _id: false },
)

const EndpointSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    agentToken: { type: String, required: true },
    status: { type: String, default: 'offline', enum: ['online', 'offline'] },
    lastSeenAt: { type: Date, default: null, index: true },

    rateLimitRule: { type: RateLimitRuleSchema, default: () => ({}) },
    webhookUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
)

EndpointSchema.index({ userId: 1, name: 1 })

export default mongoose.model('Endpoint', EndpointSchema)


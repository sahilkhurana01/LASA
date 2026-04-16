import mongoose from 'mongoose'

const ConditionSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },       // 'ip', 'path', 'statusCode', 'method', 'geo.country', 'threatType', 'userAgent'
    operator: { type: String, required: true },     // 'equals', 'contains', 'startsWith', 'endsWith', 'gt', 'lt', 'regex', 'in'
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false },
)

const AlertRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint', default: null, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    conditions: [ConditionSchema],
    conditionLogic: { type: String, default: 'AND', enum: ['AND', 'OR'] },
    action: { type: String, required: true, enum: ['alert', 'block', 'log-only'] },
    severity: { type: String, default: 'medium', enum: ['low', 'medium', 'high', 'critical'] },
    enabled: { type: Boolean, default: true },
    triggerCount: { type: Number, default: 0 },
    lastTriggeredAt: { type: Date, default: null },
  },
  { timestamps: true },
)

AlertRuleSchema.index({ userId: 1, enabled: 1 })

export default mongoose.model('AlertRule', AlertRuleSchema)

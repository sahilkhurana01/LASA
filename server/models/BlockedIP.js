import mongoose from 'mongoose'

const BlockedIPSchema = new mongoose.Schema(
  {
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ip: { type: String, required: true, index: true },
    reason: { type: String, default: '' },
    blockedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null },
    severity: { type: String, default: 'medium', enum: ['low', 'medium', 'high', 'critical'] },
  },
  { timestamps: false },
)

BlockedIPSchema.index({ userId: 1, endpointId: 1, ip: 1 }, { unique: true })
BlockedIPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('BlockedIP', BlockedIPSchema)


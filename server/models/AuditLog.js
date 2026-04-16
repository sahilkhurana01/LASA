import mongoose from 'mongoose'

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint', default: null, index: true },
    actorClerkId: { type: String, default: null },
    action: { type: String, required: true, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
)

export default mongoose.model('AuditLog', AuditLogSchema)


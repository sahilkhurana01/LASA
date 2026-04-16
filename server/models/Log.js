import mongoose from 'mongoose'

const LogSchema = new mongoose.Schema(
  {
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    ip: { type: String, required: true, index: true },
    method: { type: String, default: 'GET', index: true },
    path: { type: String, required: true, index: true },
    statusCode: { type: Number, default: 200, index: true },
    userAgent: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
    rawLog: { type: String, default: '' },

    isSuspicious: { type: Boolean, default: false, index: true },
    threatType: { type: String, default: null, index: true },
    aiAnalysis: {
      severity: { type: String, default: null },
      reason: { type: String, default: null },
      model: { type: String, default: null },
      raw: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    geo: {
      country: { type: String, default: null },
      city: { type: String, default: null },
      region: { type: String, default: null },
      isp: { type: String, default: null },
    },
  },
  { timestamps: false },
)

// Full-text search across common fields
LogSchema.index({ rawLog: 'text', path: 'text', ip: 'text', userAgent: 'text', threatType: 'text' })

export default mongoose.model('Log', LogSchema)


import mongoose from 'mongoose'

const AlertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint', required: true, index: true },
    logId: { type: mongoose.Schema.Types.ObjectId, ref: 'Log', required: true, index: true },
    message: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], index: true },
    sentAt: { type: Date, default: Date.now, index: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: false },
)

export default mongoose.model('Alert', AlertSchema)


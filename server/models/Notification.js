import mongoose from 'mongoose'

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['threat', 'ip_blocked', 'report_ready', 'endpoint_offline', 'rule_triggered', 'info'],
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    severity: { type: String, default: 'low', enum: ['low', 'medium', 'high', 'critical'] },
    read: { type: Boolean, default: false, index: true },
    link: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
)

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

export default mongoose.model('Notification', NotificationSchema)

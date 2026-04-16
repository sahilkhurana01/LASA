import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    plan: { type: String, default: 'free', enum: ['free', 'pro', 'enterprise'] },
    alertPrefs: {
      emailEnabled: { type: Boolean, default: true },
      minSeverity: { type: String, default: 'high', enum: ['low', 'medium', 'high', 'critical'] },
    },
    reportPreferences: {
      dailyReport: { type: Boolean, default: true },
      weeklyReport: { type: Boolean, default: true },
      reportTime: { type: String, default: '08:00' },
      minRiskToEmail: { type: String, default: 'low', enum: ['low', 'medium', 'high', 'critical'] },
      includeRawStats: { type: Boolean, default: true },
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
)

export default mongoose.model('User', UserSchema)

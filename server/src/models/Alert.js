import mongoose from 'mongoose'

const alertSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    ip: { type: String, required: true },
    attackType: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    description: { type: String },
    aiReport: {
        classification: { type: String },
        severity: { type: String },
        impact: { type: String },
        mitigation: { type: String },
        firewallRules: { type: String },
        summary: { type: String },
        fullReport: { type: String },
    },
    status: { type: String, enum: ['active', 'investigating', 'resolved'], default: 'active' },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
}, { timestamps: true })

alertSchema.index({ projectId: 1, createdAt: -1 })

export default mongoose.model('Alert', alertSchema)

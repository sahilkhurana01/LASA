import mongoose from 'mongoose'

const logSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    ip: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    endpoint: { type: String, required: true },
    method: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'], default: 'GET' },
    statusCode: { type: Number },
    userAgent: { type: String },
    rawLog: { type: String },
    attackType: { type: String, enum: ['SQL Injection', 'XSS', 'Brute Force', 'Rate Abuse', 'Admin Abuse', null], default: null },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    flagged: { type: Boolean, default: false },
}, { timestamps: true })

logSchema.index({ projectId: 1, timestamp: -1 })
logSchema.index({ ip: 1, timestamp: -1 })

export default mongoose.model('Log', logSchema)

import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    ownerId: { type: String, required: true, index: true },
    serverType: { type: String, enum: ['Node', 'Apache', 'Nginx'], default: 'Node' },
    apiKey: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
    logCount: { type: Number, default: 0 },
    threatCount: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('Project', projectSchema)

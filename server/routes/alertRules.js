import express from 'express'

import { requireDashboardAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import AlertRule from '../models/AlertRule.js'
import AuditLog from '../models/AuditLog.js'

const router = express.Router()

async function getMongoUser(req) {
  const userId = req.auth.userId
  const user = await User.findOne({ clerkId: userId })
  if (!user) throw new Error('User not synced. Call /api/auth/sync after login.')
  return user
}

// GET /api/alert-rules — List all rules for user
router.get('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const rules = await AlertRule.find({ userId: user._id }).sort({ createdAt: -1 }).lean()
    res.json({ rules })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch alert rules' })
  }
})

// POST /api/alert-rules — Create new rule
router.post('/', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const { name, description, conditions, conditionLogic, action, severity, endpointId, enabled } = req.body || {}

    if (!name || !conditions || !action) {
      return res.status(400).json({ error: 'name, conditions, and action are required' })
    }

    const rule = await AlertRule.create({
      userId: user._id,
      endpointId: endpointId || null,
      name,
      description: description || '',
      conditions: conditions || [],
      conditionLogic: conditionLogic || 'AND',
      action,
      severity: severity || 'medium',
      enabled: enabled !== false,
    })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'alertRule.create',
      meta: { ruleName: name },
    })

    res.status(201).json({ rule })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create alert rule' })
  }
})

// PATCH /api/alert-rules/:id — Update rule
router.patch('/:id', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const update = {}
    const body = req.body || {}
    if (body.name !== undefined) update.name = body.name
    if (body.description !== undefined) update.description = body.description
    if (body.conditions !== undefined) update.conditions = body.conditions
    if (body.conditionLogic !== undefined) update.conditionLogic = body.conditionLogic
    if (body.action !== undefined) update.action = body.action
    if (body.severity !== undefined) update.severity = body.severity
    if (body.endpointId !== undefined) update.endpointId = body.endpointId || null
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled

    const rule = await AlertRule.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { $set: update },
      { new: true },
    )
    if (!rule) return res.status(404).json({ error: 'Rule not found' })
    res.json({ rule })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update rule' })
  }
})

// DELETE /api/alert-rules/:id — Delete rule
router.delete('/:id', requireDashboardAuth, async (req, res) => {
  try {
    const user = await getMongoUser(req)
    const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, userId: user._id })
    if (!rule) return res.status(404).json({ error: 'Rule not found' })

    await AuditLog.create({
      userId: user._id,
      actorClerkId: user.clerkId,
      action: 'alertRule.delete',
      meta: { ruleName: rule.name },
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete rule' })
  }
})

export default router

// ── Rule Evaluation Engine ─────────────────────────────────
export function evaluateRules(rules, logEntry) {
  const triggered = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.endpointId && String(rule.endpointId) !== String(logEntry.endpointId)) continue

    const results = rule.conditions.map((cond) => evaluateCondition(cond, logEntry))
    const match = rule.conditionLogic === 'OR'
      ? results.some(Boolean)
      : results.every(Boolean)

    if (match) triggered.push(rule)
  }

  return triggered
}

function evaluateCondition(cond, logEntry) {
  const fieldValue = getNestedField(logEntry, cond.field)
  if (fieldValue === undefined || fieldValue === null) return false

  const val = String(fieldValue).toLowerCase()
  const target = String(cond.value).toLowerCase()

  switch (cond.operator) {
    case 'equals': return val === target
    case 'contains': return val.includes(target)
    case 'startsWith': return val.startsWith(target)
    case 'endsWith': return val.endsWith(target)
    case 'gt': return Number(fieldValue) > Number(cond.value)
    case 'lt': return Number(fieldValue) < Number(cond.value)
    case 'regex':
      try { return new RegExp(cond.value, 'i').test(String(fieldValue)) } catch { return false }
    case 'in':
      return Array.isArray(cond.value)
        ? cond.value.map(String).map(s => s.toLowerCase()).includes(val)
        : val === target
    default: return false
  }
}

function getNestedField(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj)
}

import * as React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAppStore } from '@/state/appStore'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'

const steps = [
  {
    title: 'Create Endpoint',
    body: 'Add your first endpoint to generate an agent token.',
    href: '/dashboard/endpoints',
  },
  {
    title: 'Install Agent',
    body: 'Install the npm agent on your server.',
    code: 'npm install lasa-agent',
  },
  {
    title: 'Verify Connection',
    body: 'Select the endpoint and check LIVE logs.',
    href: '/dashboard/logs',
  },
  {
    title: 'Done',
    body: 'You can now triage alerts, block IPs, and export.',
    href: '/dashboard',
  },
] as const

export function OnboardingPage() {
  const navigate = useNavigate()
  const onboardingDone = useAppStore((s) => s.onboardingDone)
  const setOnboardingDone = useAppStore((s) => s.setOnboardingDone)
  const [idx, setIdx] = React.useState(0)

  const step = steps[idx]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--color-muted)]">First-time setup</div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            Onboarding
          </div>
        </div>
        {onboardingDone && <Badge tone="success">completed</Badge>}
      </div>

      <Card className="p-6">
        <div className="text-xs text-[var(--color-muted)]">Step {idx + 1} / {steps.length}</div>
        <div className="mt-2 text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {step.title}
        </div>
        <div className="mt-2 text-sm text-[var(--color-muted)]">{step.body}</div>

        {'code' in step && step.code ? (
          <pre className="mt-4 rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-3 text-xs overflow-auto">
            {step.code}
          </pre>
        ) : null}

        {'href' in step && step.href ? (
          <div className="mt-4">
            <Link to={step.href}>
              <Button variant="primary">Open</Button>
            </Link>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <Button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            {idx === steps.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => {
                  setOnboardingDone(true)
                  navigate('/dashboard')
                }}
              >
                Finish
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}>
                Next
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}


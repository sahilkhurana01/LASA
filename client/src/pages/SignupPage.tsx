import { SignUp } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import CountUp from 'react-countup'

import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'

export function SignupPage() {
  return (
    <div className="min-h-screen grid-bg scanline flex items-center justify-center p-6">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-8 glow-hover">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[rgba(0,245,255,0.08)] border border-[rgba(0,245,255,0.14)] grid place-items-center">
              <Shield className="h-5 w-5 text-[var(--color-cyan)]" />
            </div>
            <div>
              <div className="text-xs tracking-wide text-[var(--color-muted)]">LASA</div>
              <div className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                Create Workspace
              </div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-8">
            <div className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              Ship a SOC UI in minutes.
            </div>
            <div className="mt-3 text-sm text-[var(--color-muted)] leading-relaxed">
              Add endpoints, install the agent, verify connection, then stream live logs and block threats automatically.
            </div>
          </motion.div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs text-[var(--color-muted)]">Setup</div>
              <div className="mt-2 text-xl font-semibold font-mono">
                <CountUp end={4} duration={0.8} /> steps
              </div>
            </div>
            <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs text-[var(--color-muted)]">Default block rule</div>
              <div className="mt-2 text-xl font-semibold font-mono">5/10m</div>
            </div>
            <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs text-[var(--color-muted)]">Exports</div>
              <div className="mt-2 text-xl font-semibold font-mono">CSV</div>
            </div>
          </div>

          <div className="mt-6">
            <Badge tone="cyan">Pro tip: add a webhook per endpoint for Slack/Discord.</Badge>
          </div>
        </Card>

        <Card className="p-6 grid place-items-center glow-hover">
          <SignUp routing="path" path="/signup" signInUrl="/login" />
        </Card>
      </div>
    </div>
  )
}


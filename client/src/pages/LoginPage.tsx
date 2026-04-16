import { SignIn } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import CountUp from 'react-countup'

import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'

export function LoginPage() {
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
                Operator Login
              </div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-8">
            <div className="text-4xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              <CountUp end={127_430} duration={1.3} separator="," />+
            </div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">threats blocked today (live feed)</div>
          </motion.div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs text-[var(--color-muted)]">Active endpoints</div>
              <div className="mt-2 text-xl font-semibold font-mono">
                <CountUp end={18} duration={1.0} />
              </div>
            </div>
            <div className="rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs text-[var(--color-muted)]">Mean time to detect</div>
              <div className="mt-2 text-xl font-semibold font-mono">
                <CountUp end={320} duration={1.0} />ms
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Badge tone="cyan">Tip: create one endpoint per service/environment.</Badge>
          </div>
        </Card>

        <Card className="p-6 grid place-items-center glow-hover">
          <SignIn routing="path" path="/login" signUpUrl="/signup" />
        </Card>
      </div>
    </div>
  )
}


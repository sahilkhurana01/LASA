import * as React from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { Shield, ArrowRight, Sparkles, Radar, Ban, Mail } from 'lucide-react'

import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'

function FakeLogFeed() {
  const [lines, setLines] = React.useState<string[]>([])
  React.useEffect(() => {
    const ips = ['91.203.12.4', '185.77.21.9', '45.134.22.31', '104.28.12.8', '78.141.200.2']
    const paths = ['/login', '/admin', '/wp-login.php', '/api/auth', '/.env', '/graphql', '/search?q=<script>']
    const methods = ['GET', 'POST', 'PUT']
    const threats = ['SQLi', 'XSS', 'Brute Force', 'Scanner', 'Path Traversal']
    const statuses = [200, 401, 403, 404, 429, 500]
    const mk = () => {
      const ip = ips[Math.floor(Math.random() * ips.length)]
      const path = paths[Math.floor(Math.random() * paths.length)]
      const m = methods[Math.floor(Math.random() * methods.length)]
      const st = statuses[Math.floor(Math.random() * statuses.length)]
      const threat = Math.random() < 0.35 ? ` • ${threats[Math.floor(Math.random() * threats.length)]}` : ''
      const ts = new Date().toISOString().slice(11, 19)
      return `${ts}  ${ip}  ${m} ${path}  ${st}${threat}`
    }
    setLines(Array.from({ length: 22 }, mk))
    const id = window.setInterval(() => {
      setLines((prev) => [mk(), ...prev].slice(0, 40))
    }, 550)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl border border-[rgba(0,245,255,0.10)] bg-[rgba(17,24,39,0.55)]">
      <div className="absolute inset-0 opacity-60" />
      <div className="absolute inset-0 p-4 font-mono text-xs text-[rgba(190,255,255,0.85)]">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre leading-5">
            {l}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(10,13,18,0.95)] to-transparent" />
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen grid-bg scanline">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[rgba(0,245,255,0.08)] border border-[rgba(0,245,255,0.14)] grid place-items-center">
              <Shield className="h-5 w-5 text-[var(--color-cyan)]" />
            </div>
            <div>
              <div className="text-xs tracking-wide text-[var(--color-muted)]">LASA</div>
              <div className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                Log Analysis & Security Alert
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignedOut>
              <Link to="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link to="/dashboard">
                <Button variant="primary">
                  Open Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </SignedIn>
          </div>
        </header>

        <section className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge tone="cyan">
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              Cyberpunk-meets-enterprise • production-ready
            </Badge>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-4 text-4xl sm:text-5xl font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Monitor Every Request.
              <br />
              Block Every Threat.
            </motion.h1>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              LASA is an AI-powered log monitoring SaaS: real-time streaming, threat detection,
              instant IP blocking, email + webhook alerts — built for developers.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <SignedOut>
                <Link to="/signup">
                  <Button variant="primary" className="w-full sm:w-auto">
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button className="w-full sm:w-auto">Login</Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link to="/dashboard/endpoints">
                  <Button variant="primary" className="w-full sm:w-auto">
                    Add Endpoint <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </SignedIn>
            </div>

            <div className="mt-5 text-xs text-[var(--color-muted)]">
              Agent install: <span className="font-mono text-[var(--color-fg)]">npm install lasa-agent</span>
            </div>
          </div>

          <div className="space-y-4">
            <FakeLogFeed />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4 glow-hover">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                  <Radar className="h-4 w-4 text-[var(--color-cyan)]" /> Realtime
                </div>
                <div className="mt-2 text-xs text-[var(--color-muted)]">Socket rooms per endpointId.</div>
              </Card>
              <Card className="p-4 glow-hover">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                  <Ban className="h-4 w-4 text-[var(--color-danger)]" /> Auto-block
                </div>
                <div className="mt-2 text-xs text-[var(--color-muted)]">5+ suspicious in 10 minutes.</div>
              </Card>
              <Card className="p-4 glow-hover">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                  <Mail className="h-4 w-4 text-[var(--color-warn)]" /> Alerts
                </div>
                <div className="mt-2 text-xs text-[var(--color-muted)]">Email + webhook on threat.</div>
              </Card>
            </div>
          </div>
        </section>

        <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-6 glow-hover">
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Real-time monitoring</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">Stream logs instantly, filter, drill down, export.</div>
          </Card>
          <Card className="p-6 glow-hover">
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>AI threat detection</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">OpenRouter analysis returns structured JSON verdicts.</div>
          </Card>
          <Card className="p-6 glow-hover">
            <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Developer-first</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">Endpoints + agent tokens + webhooks per service.</div>
          </Card>
        </section>

        <section className="mt-12 card rounded-2xl p-6">
          <div className="text-sm text-[var(--color-muted)]">Pricing</div>
          <div className="mt-2 text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Simple plans</div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 glow-hover">
              <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Free</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">1 endpoint • 1000 logs/day</div>
            </Card>
            <Card className="p-6 glow-hover">
              <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Pro</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">$29/mo • 10 endpoints</div>
            </Card>
            <Card className="p-6 glow-hover">
              <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Enterprise</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">Custom • SSO • SLAs • Volume</div>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}


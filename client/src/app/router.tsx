import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { App } from '@/App'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { EndpointsPage } from '@/pages/dashboard/EndpointsPage'
import { LogsPage } from '@/pages/dashboard/LogsPage'
import { BlockedIPsPage } from '@/pages/dashboard/BlockedIPsPage'
import { AlertsPage } from '@/pages/dashboard/AlertsPage'
import { SettingsPage } from '@/pages/dashboard/SettingsPage'
import { AuditPage } from '@/pages/dashboard/AuditPage'
import { OnboardingPage } from '@/pages/dashboard/OnboardingPage'
import { ReportsPage } from '@/pages/dashboard/ReportsPage'
import { ReportDetailPage } from '@/pages/dashboard/ReportDetailPage'
import { IPIntelligencePage } from '@/pages/dashboard/IPIntelligencePage'
import { AlertRulesPage } from '@/pages/dashboard/AlertRulesPage'

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <LandingPage /> },
      {
        path: '/login/*',
        element: (
          <SignedOut>
            <LoginPage />
          </SignedOut>
        ),
      },
      {
        path: '/signup/*',
        element: (
          <SignedOut>
            <SignupPage />
          </SignedOut>
        ),
      },
      {
        path: '/dashboard',
        element: (
          <Protected>
            <DashboardLayout />
          </Protected>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'onboarding', element: <OnboardingPage /> },
          { path: 'endpoints', element: <EndpointsPage /> },
          { path: 'logs', element: <LogsPage /> },
          { path: 'blocked-ips', element: <BlockedIPsPage /> },
          { path: 'alerts', element: <AlertsPage /> },
          { path: 'audit', element: <AuditPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'reports/:id', element: <ReportDetailPage /> },
          { path: 'ip-intelligence', element: <IPIntelligencePage /> },
          { path: 'alert-rules', element: <AlertRulesPage /> },
        ],
      },

      // Clerk callback fallback
      { path: '/sign-in/*', element: <SignIn routing="path" path="/sign-in" signUpUrl="/signup" /> },
      { path: '/sign-up/*', element: <SignUp routing="path" path="/sign-up" signInUrl="/login" /> },
    ],
  },
])

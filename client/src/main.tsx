import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { router } from '@/app/router'
import '@/index.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(17,24,39,0.98)',
              color: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(0,245,255,0.12)',
            },
          }}
        />
      </ClerkProvider>
    ) : (
      <div className="min-h-screen grid-bg grid place-items-center p-6">
        <div className="card rounded-2xl p-6 max-w-xl w-full">
          <div className="text-xs tracking-wide text-[var(--color-muted)]">LASA</div>
          <div className="mt-2 text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            Missing Clerk publishable key
          </div>
          <p className="mt-3 text-[var(--color-muted)]">
            Set <span className="font-mono text-[var(--color-fg)]">VITE_CLERK_PUBLISHABLE_KEY</span> in
            <span className="font-mono text-[var(--color-fg)]"> client/.env</span> and restart.
          </p>
        </div>
      </div>
    )}
  </React.StrictMode>,
)


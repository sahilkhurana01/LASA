import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/shared/cn'

export function Modal({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onMouseDown={onClose} aria-hidden="true" />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          className={cn('card w-full max-w-xl rounded-2xl border border-[rgba(0,245,255,0.12)]', className)}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,245,255,0.10)]">
            <div className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              {title}
            </div>
            <button
              className="rounded-lg border border-transparent hover:border-[rgba(0,245,255,0.14)] hover:bg-white/5 p-2"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4 text-[var(--color-muted)]" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}


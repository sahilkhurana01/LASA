import * as React from 'react'
import { cn } from '@/shared/cn'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm',
        'placeholder:text-[rgba(255,255,255,0.40)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,245,255,0.18)] focus:border-[rgba(0,245,255,0.22)]',
        className,
      )}
      {...props}
    />
  )
}


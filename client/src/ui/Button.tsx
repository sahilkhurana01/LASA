import * as React from 'react'
import { cn } from '@/shared/cn'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ className, variant = 'secondary', size = 'md', ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium transition',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        size === 'md' ? 'px-4 py-2' : 'px-3 py-1.5 text-xs rounded-lg',
        variant === 'primary' &&
          'border-[rgba(0,245,255,0.24)] bg-[rgba(0,245,255,0.10)] hover:bg-[rgba(0,245,255,0.14)]',
        variant === 'secondary' &&
          'border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]',
        variant === 'ghost' &&
          'border-transparent bg-transparent hover:border-[rgba(0,245,255,0.10)] hover:bg-[rgba(255,255,255,0.03)]',
        variant === 'danger' &&
          'border-[rgba(255,45,85,0.28)] bg-[rgba(255,45,85,0.10)] hover:bg-[rgba(255,45,85,0.14)]',
        className,
      )}
      {...props}
    />
  )
}


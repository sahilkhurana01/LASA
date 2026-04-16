import { cn } from '@/shared/cn'

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'cyan' | 'danger' | 'warn' | 'success'
}

export function Badge({ className, tone = 'neutral', ...props }: Props) {
  const styles =
    tone === 'cyan'
      ? 'border-[rgba(0,245,255,0.22)] bg-[rgba(0,245,255,0.10)] text-[rgba(190,255,255,0.92)]'
      : tone === 'danger'
        ? 'border-[rgba(255,45,85,0.22)] bg-[rgba(255,45,85,0.10)] text-[rgba(255,200,210,0.92)]'
        : tone === 'warn'
          ? 'border-[rgba(255,184,0,0.22)] bg-[rgba(255,184,0,0.10)] text-[rgba(255,230,180,0.92)]'
          : tone === 'success'
            ? 'border-[rgba(0,255,136,0.22)] bg-[rgba(0,255,136,0.10)] text-[rgba(190,255,220,0.92)]'
            : 'border-[rgba(0,245,255,0.10)] bg-[rgba(255,255,255,0.02)] text-[var(--color-muted)]'

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', styles, className)} {...props} />
  )
}


import { cn } from '@/shared/cn'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card rounded-2xl', className)} {...props} />
}


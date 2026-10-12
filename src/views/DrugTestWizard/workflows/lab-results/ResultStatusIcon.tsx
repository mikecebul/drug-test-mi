import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/utilities/cn'

export function ResultStatusIcon({
  variant,
  className,
}: {
  variant: 'success' | 'warning' | 'destructive'
  className?: string
}) {
  const Icon = variant === 'success' ? CheckCircle2 : AlertCircle
  return (
    <Icon
      aria-hidden
      strokeWidth={variant === 'destructive' ? 2.5 : 2}
      className={cn(
        'size-5 shrink-0',
        variant === 'destructive'
          ? 'text-destructive fill-current [&>line]:stroke-white [&>path]:stroke-white'
          : variant === 'success'
            ? 'text-success-foreground'
            : 'text-warning-foreground',
        className,
      )}
    />
  )
}

// A stronger red, derived from the existing light/dark theme tokens.
export const resultDangerText = 'text-[color-mix(in_oklch,var(--destructive)_80%,var(--destructive-foreground))]'

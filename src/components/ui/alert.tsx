import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utilities/cn'

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-4 items-start [&>svg]:size-5 [&>svg]:translate-y-0.5 [&>svg]:text-current [&>svg]:self-center',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'text-destructive-foreground bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive',
        success: 'text-success-foreground bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-success',
        warning: 'text-warning-foreground bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-warning',
        info:
          'border-info/40 bg-info-muted text-info-foreground [&>svg]:text-info-foreground *:data-[slot=alert-description]:text-info-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}
function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 text-lg font-medium tracking-tight', className)}
      {...props}
    />
  )
}
function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-base [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn('col-start-2 mt-3 sm:absolute sm:top-3 sm:right-3 sm:mt-0', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }

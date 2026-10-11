'use client'

import { Check } from 'lucide-react'
import { cn } from '@/utilities/cn'

export function WorkflowProgress({
  steps,
  activeStep,
  completed = false,
  label = 'Workflow progress',
  className,
}: {
  steps: readonly { key: string; label: string }[]
  activeStep: string
  completed?: boolean
  label?: string
  className?: string
}) {
  const current = steps.findIndex((step) => step.key === activeStep)
  return (
    <nav aria-label={label} className={cn('mr-8 sm:mr-0', className)}>
      <ol className="flex items-start">
        {steps.map((step, index) => (
          <li
            key={step.key}
            aria-current={!completed && index === current ? 'step' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'bg-border absolute top-4 left-1/2 h-px w-full',
                  (completed || index < current) && 'bg-primary',
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'border-border bg-background text-muted-foreground relative flex size-8 items-center justify-center rounded-full border text-sm font-medium',
                (completed || index < current) && 'border-success-border bg-success text-success-foreground',
                !completed && index === current && 'border-primary bg-primary text-primary-foreground',
              )}
            >
              {completed || index < current ? <Check className="size-4" /> : index + 1}
            </span>
            <span
              className={cn(
                'text-muted-foreground text-xs sm:text-sm',
                index === current && 'text-foreground font-semibold',
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

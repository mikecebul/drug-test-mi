'use client'

import { Check } from 'lucide-react'
import { cn } from '@/utilities/cn'

const phases = ['Client', 'Payment', 'Prepare', 'Details', 'Review'] as const
export type CollectionPhase = (typeof phases)[number]

/** Phases group the conditional screens; they are not a fixed screen count. */
export function CollectionProgress({ phase, completed = false }: { phase: CollectionPhase; completed?: boolean }) {
  const current = phases.indexOf(phase)
  return (
    <nav aria-label="Collection progress" className="mb-8">
      <ol className="flex items-start">
        {phases.map((label, index) => (
          <li
            key={label}
            aria-current={!completed && index === current ? 'step' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            {index < phases.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'bg-border absolute top-3 left-1/2 h-px w-full',
                  (completed || index < current) && 'bg-primary',
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'border-border bg-background relative flex size-6 items-center justify-center rounded-full border',
                (completed || index <= current) && 'border-primary bg-primary text-primary-foreground',
              )}
            >
              {(completed || index < current) && <Check className="size-4" />}
            </span>
            <span
              className={cn(
                'text-muted-foreground text-xs sm:text-sm',
                index === current && 'text-foreground font-semibold',
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

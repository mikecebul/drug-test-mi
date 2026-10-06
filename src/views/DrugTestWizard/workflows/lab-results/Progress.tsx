'use client'
import { Check } from 'lucide-react'
import { cn } from '@/utilities/cn'
import { labSteps } from './model'
export function LabProgress({ step, completed = false }: { step: (typeof labSteps)[number]; completed?: boolean }) {
  return (
    <nav aria-label="Lab result steps">
      <ol className="flex items-center gap-2 pr-10">
        {labSteps.map((name, at) => (
          <li
            key={name}
            aria-current={!completed && name === step ? 'step' : undefined}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <span
              aria-hidden
              className={cn(
                'border-border flex size-8 shrink-0 items-center justify-center rounded-full border',
                completed || at < labSteps.indexOf(step)
                  ? 'bg-success text-success-foreground'
                  : name === step
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground',
              )}
            >
              {completed || at < labSteps.indexOf(step) ? <Check className="size-4" /> : at + 1}
            </span>
            <span className="truncate text-sm capitalize">{name}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

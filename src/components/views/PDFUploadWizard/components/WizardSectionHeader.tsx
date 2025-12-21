import React from 'react'
import { cn } from '@/utilities/cn'

interface WizardSectionHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * Section header for use within cards (smaller than FieldGroupHeader)
 * Includes optional action slot for buttons/controls
 */
export function WizardSectionHeader({
  title,
  description,
  action,
  className,
}: WizardSectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between pb-4', className)}>
      <div>
        <h3 className="text-xl font-semibold">{title}</h3>
        {description && <p className="text-muted-foreground text-lg">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

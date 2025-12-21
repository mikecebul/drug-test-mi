import React from 'react'
import { WizardCard } from './WizardCard'
import { cn } from '@/utilities/cn'

interface EmptyStateProps {
  message: string
  className?: string
}

/**
 * Consistent empty/no-data state for wizard field groups
 */
export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <WizardCard className={className}>
      <p className="text-muted-foreground py-6 text-center text-lg">{message}</p>
    </WizardCard>
  )
}

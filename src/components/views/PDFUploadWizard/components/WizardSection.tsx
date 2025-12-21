import React from 'react'
import { cn } from '@/utilities/cn'

interface WizardSectionProps {
  children: React.ReactNode
  className?: string
}

/**
 * Container with consistent vertical spacing for wizard field groups
 */
export function WizardSection({ children, className }: WizardSectionProps) {
  return <div className={cn('space-y-6', className)}>{children}</div>
}

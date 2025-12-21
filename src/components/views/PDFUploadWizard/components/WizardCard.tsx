import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/utilities/cn'

interface WizardCardProps {
  children: React.ReactNode
  className?: string
}

/**
 * Wrapper around shadcn Card with wizard-specific defaults
 * - Tighter padding (p-4 instead of default p-6)
 * - Consistent shadow-md
 * - Consistent vertical spacing
 */
export function WizardCard({ children, className }: WizardCardProps) {
  return (
    <Card className={cn('shadow-md', className)}>
      <CardContent className="space-y-4 p-4">{children}</CardContent>
    </Card>
  )
}

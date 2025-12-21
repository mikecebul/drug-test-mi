import React from 'react'
import { Loader2 } from 'lucide-react'
import { WizardCard } from './WizardCard'
import { cn } from '@/utilities/cn'

interface LoadingCardProps {
  message?: string
  className?: string
}

/**
 * Consistent loading state card for wizard field groups
 */
export function LoadingCard({ message = 'Loading...', className }: LoadingCardProps) {
  return (
    <WizardCard className={className}>
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <Loader2 className="text-primary h-12 w-12 animate-spin" />
        <p className="text-muted-foreground text-lg">{message}</p>
      </div>
    </WizardCard>
  )
}

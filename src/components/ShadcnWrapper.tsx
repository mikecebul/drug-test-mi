import React from 'react'

import { cn } from '@/utilities/cn'

interface ShadcnWrapperProps {
  children: React.ReactNode
  className?: string
}

/**
 * Wrapper component that provides scoped preflight styles for shadcn/ui components
 * in the Payload admin interface. This ensures shadcn components work properly
 * without interfering with existing admin styles.
 */
export const ShadcnWrapper: React.FC<ShadcnWrapperProps> = ({ children, className = '' }) => {
  return (
    <div data-twp className={cn('text-foreground border-border outline-ring/50 pb-8', className)}>
      {children}
    </div>
  )
}

export default ShadcnWrapper

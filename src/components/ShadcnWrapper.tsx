import React from 'react'

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
    <div data-twp className={className}>
      {children}
    </div>
  )
}

export default ShadcnWrapper

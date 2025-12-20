import React from 'react'

interface WizardHeaderProps {
  title: string
  description: string
}

/**
 * Main header component for PDF Upload Wizard pages
 * Used for workflow titles and main wizard sections
 *
 * Features:
 * - Title: text-3xl md:text-5xl (responsive scaling)
 * - Description: lg:text-xl (larger on desktop)
 * - Consistent spacing: space-y-4
 */
export function WizardHeader({ title, description }: WizardHeaderProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
      <p className="text-muted-foreground lg:text-xl">{description}</p>
    </div>
  )
}

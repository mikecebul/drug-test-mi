import React from 'react'
import { cn } from '@/utilities/cn'

interface FieldGroupHeaderProps {
  title: string
  description?: string
  className?: string
}

/**
 * Reusable header component for Drug Test Wizard field groups
 * Replaces the repetitive title + description pattern used across all field groups
 *
 * Features:
 * - Title: text-3xl
 * - Description: text-lg
 * - Consistent spacing: space-y-3
 */
export function FieldGroupHeader({ title, description, className }: FieldGroupHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2 pb-2', className)}>
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
    </div>
  )
}

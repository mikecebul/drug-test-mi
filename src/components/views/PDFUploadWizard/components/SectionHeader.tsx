import React from 'react'
import { cn } from '@/utilities/cn'

interface SectionHeaderProps {
  icon: React.ReactNode
  title: string
  className?: string
}

/**
 * Reusable section header component for PDF Upload Wizard
 * Standardizes the icon + title pattern used in verification field groups
 *
 * Features:
 * - Title: text-2xl (up from text-xl)
 * - Icon wrapper: h-10 w-10 (up from h-8 w-8)
 * - Icon size should be h-5 w-5 (passed as prop)
 * - Gap: gap-3 (up from gap-2.5)
 */
export function SectionHeader({ icon, title, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      <div className="flex items-center gap-3">
        <div className="bg-primary/20 flex h-10 w-10 items-center justify-center rounded-full">
          {icon}
        </div>
        <h3 className="text-foreground text-2xl font-semibold">{title}</h3>
      </div>
    </div>
  )
}

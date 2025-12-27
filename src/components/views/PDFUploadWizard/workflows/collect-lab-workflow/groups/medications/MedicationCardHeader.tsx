'use client'

import { forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pill, ChevronDown, Trash2 } from 'lucide-react'
import { cn } from '@/utilities/cn'
import { formatSubstance } from '@/lib/substances'

interface MedicationCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  medicationName: string
  detectedAs: string[] | null | undefined
  isDiscontinued: boolean
  isNew: boolean
  onRemove: () => void
}

export const MedicationCardHeader = forwardRef<HTMLDivElement, MedicationCardHeaderProps>(function MedicationCardHeader(
  { medicationName, detectedAs, isDiscontinued, isNew, onRemove, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'group hover:bg-muted/50 flex cursor-pointer items-center justify-between p-4 transition-colors',
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 items-center gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            isDiscontinued ? 'bg-muted' : 'bg-primary/10',
          )}
        >
          <Pill className={cn('size-5', isDiscontinued ? 'text-muted-foreground' : 'text-primary')} />
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className={cn('text-lg font-medium', {
                'text-muted-foreground line-through': isDiscontinued,
              })}
            >
              {medicationName || 'New Medication'}
            </span>
            <Badge variant={isDiscontinued ? 'secondary' : 'default'} className="ml-1">
              {isDiscontinued ? 'Discontinued' : 'Active'}
            </Badge>
          </div>
          {detectedAs && Array.isArray(detectedAs) && detectedAs.length > 0 && (
            <span className={cn('text-sm', isDiscontinued ? 'text-muted-foreground' : 'text-warning-foreground')}>
              Shows as: {detectedAs.map((s: string) => formatSubstance(s, true)).join(', ')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {isNew && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive size-8"
            title="Remove medication"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <ChevronDown className="size-4 transition-transform duration-200 group-data-panel-open:rotate-180" />
      </div>
    </div>
  )
})

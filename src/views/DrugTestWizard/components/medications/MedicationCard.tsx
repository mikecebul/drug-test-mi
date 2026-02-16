'use client'

import { formatDateOnly } from '@/lib/date-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Pill, Edit, XCircle, RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import type { Medication } from '@/app/dashboard/medications/types'
import { formatSubstance } from '@/lib/substances'
import { cn } from '@/utilities/cn'

interface MedicationCardProps {
  medication: Medication
  index: number
  onEdit: (index: number) => void
  onToggleStatus: (index: number) => void
  isDiscontinued?: boolean
}

export function MedicationCard({
  medication,
  index,
  onEdit,
  onToggleStatus,
  isDiscontinued = false,
}: MedicationCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn(isDiscontinued && 'bg-muted/30 opacity-60')}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 items-start gap-3">
              <div
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-full',
                  isDiscontinued ? 'bg-muted' : 'bg-primary/10',
                )}
              >
                <Pill
                  className={cn(
                    'size-6',
                    isDiscontinued ? 'text-muted-foreground' : 'text-primary',
                  )}
                />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h4
                    className={cn(
                      'text-xl font-semibold',
                      isDiscontinued && 'text-muted-foreground line-through',
                    )}
                  >
                    {medication.medicationName}
                  </h4>
                  {medication.detectedAs && medication.detectedAs.length > 0 && (
                    <p
                      className={cn(
                        'mt-1 text-base',
                        isDiscontinued ? 'text-muted-foreground' : 'text-warning',
                      )}
                    >
                      {medication.detectedAs.map((s) => formatSubstance(s)).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isDiscontinued ? 'secondary' : 'default'}>
                    {isDiscontinued ? 'Discontinued' : 'Active'}
                  </Badge>
                  {medication.requireConfirmation && (
                    <Badge variant="outline" className="border-orange-300 text-orange-600">
                      Required
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {isDiscontinued && medication.endDate
                      ? `Ended: ${formatDateOnly(medication.endDate)}`
                      : `Started: ${formatDateOnly(medication.startDate)}`}
                  </span>
                </div>
                {medication.notes && (
                  <p className="text-muted-foreground text-sm italic">{medication.notes}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {!isDiscontinued && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(index)}
                  title="Edit medication"
                >
                  <Edit className="size-5" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(index)}
                title={isDiscontinued ? 'Reactivate medication' : 'Mark as discontinued'}
                className={cn(
                  'text-muted-foreground',
                  isDiscontinued ? 'hover:text-green-600' : 'hover:text-destructive',
                )}
              >
                {isDiscontinued ? <RotateCcw className="size-5" /> : <XCircle className="size-5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

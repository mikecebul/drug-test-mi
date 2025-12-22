'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Pill, Edit, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import type { Medication } from '@/app/dashboard/medications/types'
import { formatSubstance } from '@/lib/substances'

interface MedicationCardProps {
  medication: Medication
  index: number
  onEdit: (index: number) => void
  onToggleStatus: (index: number) => void
}

export function MedicationCard({ medication, index, onEdit, onToggleStatus }: MedicationCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 items-start gap-3">
              <div className="bg-primary/10 flex size-12 shrink-0 items-center justify-center rounded-full">
                <Pill className="text-primary size-6" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="text-xl font-semibold">{medication.medicationName}</h4>
                  {medication.detectedAs && medication.detectedAs.length > 0 && (
                    <p className="text-warning mt-1 text-base">
                      {medication.detectedAs.map((s) => formatSubstance(s)).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">Active</Badge>
                  {medication.requireConfirmation && (
                    <Badge variant="outline" className="border-orange-300 text-orange-600">
                      Required
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">
                    Started: {new Date(medication.startDate).toLocaleDateString()}
                  </span>
                </div>
                {medication.notes && (
                  <p className="text-muted-foreground text-sm italic">{medication.notes}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(index)}
                title="Edit medication"
              >
                <Edit className="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(index)}
                title="Mark as discontinued"
                className="text-muted-foreground hover:text-destructive"
              >
                <XCircle className="size-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

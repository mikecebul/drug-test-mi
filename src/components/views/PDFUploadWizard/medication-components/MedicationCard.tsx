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
            <div className="flex items-start gap-3 flex-1">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full shrink-0">
                <Pill className="text-primary h-5 w-5" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-semibold">{medication.medicationName}</h4>
                  {medication.detectedAs && medication.detectedAs.length > 0 && (
                    <p className="text-muted-foreground text-sm mt-1">
                      Shows as: {medication.detectedAs.map((s) => formatSubstance(s)).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="default">Active</Badge>
                  {medication.requireConfirmation && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
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
            <div className="flex gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(index)}
                title="Edit medication"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(index)}
                title="Mark as discontinued"
                className="text-muted-foreground hover:text-destructive"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

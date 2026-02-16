'use client'

import React from 'react'
import { Pill } from 'lucide-react'
import { FormMedications } from '../../shared-validators'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'

interface MedicationDisplayFieldProps {
  medications?: FormMedications
  medicationSnapshot?: MedicationSnapshot[]
  title?: string
  description?: string
}

export default function MedicationDisplayField({
  medications,
  medicationSnapshot,
  title = 'Active Medications',
}: MedicationDisplayFieldProps) {
  // Filter to show all active medications (even if detectedAs is missing)
  const activeMedications = medications ? medications.filter(med => med.status === 'active') : medicationSnapshot

  if (!activeMedications || activeMedications.length === 0) {
    return null
  }

  return (
    <div className="border-warning/50 bg-warning-muted/50 w-full rounded-xl border p-6 shadow-md">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-warning/20 flex h-8 w-8 items-center justify-center rounded-full">
            <Pill className="text-warning h-4 w-4" />
          </div>
          <h3 className="text-foreground text-xl font-semibold">{title}</h3>
        </div>
      </div>

      {/* Medications List */}
      <ul className="space-y-2">
        {activeMedications.map((med, i) => (
          <li key={i} className="text-foreground text-sm">
            <div className="font-medium">
              • {med.medicationName}
              {med.detectedAs && med.detectedAs.length > 0 ? (
                <span className="text-muted-foreground capitalize"> ({med.detectedAs.join(', ')})</span>
              ) : (
                <span className="text-destructive italic"> (Not marked for detection)</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

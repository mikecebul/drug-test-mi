'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { MedicationCard } from './MedicationCard'
import { AddMedicationForm } from './AddMedicationForm'
import { EditMedicationForm } from './EditMedicationForm'
import type { Medication } from '@/app/dashboard/medications/types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { toast } from 'sonner'

interface MedicationListProps {
  field: any // TanStack Form field for medications array
  activeMedications: Medication[]
  allMedications: Medication[]
}

export function MedicationList({ field, activeMedications, allMedications }: MedicationListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleAdd = (data: {
    medicationName: string
    detectedAs: SubstanceValue[]
    requireConfirmation: boolean
    notes: string
  }) => {
    // Create new medication object
    const newMedication: Medication = {
      medicationName: data.medicationName,
      startDate: new Date().toISOString(),
      status: 'active',
      detectedAs: data.detectedAs as any,
      requireConfirmation: data.requireConfirmation,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    }

    // Add to medications array using field API
    field.pushValue(newMedication)
    setIsAdding(false)
    toast.success('Medication added')
  }

  const handleEdit = (data: {
    medicationName: string
    detectedAs: SubstanceValue[]
    requireConfirmation: boolean
    notes: string
  }) => {
    if (editingIndex === null) return

    // Find the actual index in the full medications array
    const actualIndex = allMedications.findIndex((med) => med === activeMedications[editingIndex])

    // Update the medication
    const updatedMedications = [...allMedications]
    updatedMedications[actualIndex] = {
      ...updatedMedications[actualIndex],
      medicationName: data.medicationName,
      detectedAs: data.detectedAs as any,
      requireConfirmation: data.requireConfirmation,
      notes: data.notes,
    }

    // Update field value
    field.setValue(updatedMedications)
    setEditingIndex(null)
    toast.success('Medication updated')
  }

  const handleMarkInactive = (activeIndex: number) => {
    // Find the actual index in the full medications array
    const actualIndex = allMedications.findIndex((med) => med === activeMedications[activeIndex])

    // Mark as discontinued
    const updatedMedications = [...allMedications]
    updatedMedications[actualIndex] = {
      ...updatedMedications[actualIndex],
      status: 'discontinued',
      endDate: new Date().toISOString(),
    }

    // Update field value
    field.setValue(updatedMedications)
    toast.success('Medication marked as discontinued')
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      {isAdding && (
        <AddMedicationForm
          onSubmit={handleAdd}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Edit form */}
      {editingIndex !== null && (
        <EditMedicationForm
          medication={activeMedications[editingIndex]}
          onSubmit={handleEdit}
          onCancel={() => setEditingIndex(null)}
        />
      )}

      {/* Medication list - only show active medications */}
      <AnimatePresence mode="sync">
        {activeMedications.map((medication, index) => (
          <MedicationCard
            key={index}
            medication={medication}
            index={index}
            onEdit={(idx) => {
              setIsAdding(false)
              setEditingIndex(idx)
            }}
            onToggleStatus={handleMarkInactive}
          />
        ))}
      </AnimatePresence>

      {/* Empty state */}
      {activeMedications.length === 0 && !isAdding && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-2">No active medications documented</p>
          <p className="text-sm">Add medications to ensure accurate drug test interpretation</p>
        </div>
      )}

      {/* Add button */}
      {!isAdding && editingIndex === null && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEditingIndex(null)
            setIsAdding(true)
          }}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Medication
        </Button>
      )}
    </div>
  )
}

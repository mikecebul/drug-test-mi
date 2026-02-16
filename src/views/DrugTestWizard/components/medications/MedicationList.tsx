'use client'

import { useState, useMemo } from 'react'
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
  medications: Medication[]
  onAddMedication: (medication: Medication) => void
  onUpdateMedication: (index: number, updatedMedication: Medication) => void
}

export function MedicationList({
  medications,
  onAddMedication,
  onUpdateMedication,
}: MedicationListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Sort medications: active first, discontinued last, preserving original indices
  const { activeMedications, discontinuedMedications } = useMemo(() => {
    const withIndices = medications.map((medication, originalIndex) => ({
      medication,
      originalIndex,
    }))

    return {
      activeMedications: withIndices.filter((item) => item.medication.status === 'active'),
      discontinuedMedications: withIndices.filter(
        (item) => item.medication.status === 'discontinued',
      ),
    }
  }, [medications])

  const handleAdd = (data: {
    medicationName: string
    detectedAs: SubstanceValue[]
    requireConfirmation: boolean
    notes: string
  }) => {
    const newMedication: Medication = {
      medicationName: data.medicationName,
      startDate: new Date().toISOString(),
      status: 'active',
      detectedAs: data.detectedAs as any,
      requireConfirmation: data.requireConfirmation,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    }

    onAddMedication(newMedication)
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

    const existingMedication = medications[editingIndex]

    const updatedMedication: Medication = {
      ...existingMedication,
      medicationName: data.medicationName,
      detectedAs: data.detectedAs as any,
      requireConfirmation: data.requireConfirmation,
      notes: data.notes,
    }

    onUpdateMedication(editingIndex, updatedMedication)
    setEditingIndex(null)
    toast.success('Medication updated')
  }

  const handleMarkInactive = (originalIndex: number) => {
    const existingMedication = medications[originalIndex]

    const updatedMedication: Medication = {
      ...existingMedication,
      status: 'discontinued',
      endDate: new Date().toISOString(),
    }

    onUpdateMedication(originalIndex, updatedMedication)
    toast.success('Medication marked as discontinued')
  }

  const handleMarkActive = (originalIndex: number) => {
    const existingMedication = medications[originalIndex]

    const updatedMedication: Medication = {
      ...existingMedication,
      status: 'active',
      endDate: undefined,
    }

    onUpdateMedication(originalIndex, updatedMedication)
    toast.success('Medication reactivated')
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      {isAdding && <AddMedicationForm onSubmit={handleAdd} onCancel={() => setIsAdding(false)} />}

      {/* Edit form */}
      {editingIndex !== null && (
        <EditMedicationForm
          medication={medications[editingIndex]}
          onSubmit={handleEdit}
          onCancel={() => setEditingIndex(null)}
        />
      )}

      {/* Active Medications */}
      <AnimatePresence mode="sync">
        {activeMedications.map(({ medication, originalIndex }) => (
          <MedicationCard
            key={`${medication.medicationName}-${medication.startDate}-${originalIndex}`}
            medication={medication}
            index={originalIndex}
            onEdit={(idx) => {
              setIsAdding(false)
              setEditingIndex(idx)
            }}
            onToggleStatus={handleMarkInactive}
          />
        ))}
      </AnimatePresence>

      {/* Discontinued Medications Section */}
      {discontinuedMedications.length > 0 && (
        <>
          <div className="border-t pt-4">
            <h4 className="text-muted-foreground mb-2 text-sm font-medium">
              Discontinued Medications
            </h4>
          </div>
          <AnimatePresence mode="sync">
            {discontinuedMedications.map(({ medication, originalIndex }) => (
              <MedicationCard
                key={`${medication.medicationName}-${medication.startDate}-${originalIndex}`}
                medication={medication}
                index={originalIndex}
                onEdit={(idx) => {
                  setIsAdding(false)
                  setEditingIndex(idx)
                }}
                onToggleStatus={handleMarkActive}
                isDiscontinued
              />
            ))}
          </AnimatePresence>
        </>
      )}

      {/* Empty state */}
      {medications.length === 0 && !isAdding && (
        <div className="text-muted-foreground py-8 text-center">
          <p className="mb-2">No medications documented</p>
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

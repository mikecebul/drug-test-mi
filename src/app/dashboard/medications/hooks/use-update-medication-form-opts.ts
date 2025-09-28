'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { UpdateMedicationFormType } from '../schemas/medicationSchemas'
import type { Dispatch, SetStateAction } from 'react'
import type { Medication } from '../types'

const defaultValues: UpdateMedicationFormType = {
  status: 'active',
  endDate: undefined,
}

export const useUpdateMedicationFormOpts = ({
  setShowDialog,
  setSelectedMedication,
  selectedMedicationIndex,
  selectedMedication,
}: {
  setShowDialog: Dispatch<SetStateAction<boolean>>
  setSelectedMedication: Dispatch<SetStateAction<Medication | null>>
  selectedMedicationIndex: number
  selectedMedication: Medication | null
}) => {
  const queryClient = useQueryClient()

  return formOptions({
    defaultValues: {
      status: selectedMedication?.status || 'active',
      endDate: selectedMedication?.endDate || '',
    },
    onSubmit: async ({ value: data, formApi }) => {
      try {
        const response = await fetch('/api/clients/medications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            medicationIndex: selectedMedicationIndex,
            status: data.status,
            endDate: data.status === 'discontinued' ? data.endDate : undefined,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to update medication')
        }

        // Refresh dashboard data
        queryClient.invalidateQueries({ queryKey: ['clientDashboard'] })
        setShowDialog(false)
        setSelectedMedication(null)
        formApi.reset()
        toast.success('Medication updated successfully!')
      } catch (error) {
        console.error('Error updating medication:', error)
        toast.error(
          error instanceof Error ? error.message : 'Updating medication failed. Please try again.',
        )
      }
    },
  })
}

export { defaultValues }
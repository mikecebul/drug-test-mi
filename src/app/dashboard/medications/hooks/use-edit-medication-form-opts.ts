'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Dispatch, SetStateAction } from 'react'
import type { Medication } from '../types'
import { editMedicationDetailsAction } from '../actions'

export const useEditMedicationFormOpts = ({
  setShowDialog,
  selectedMedicationIndex,
  selectedMedication,
}: {
  setShowDialog: Dispatch<SetStateAction<boolean>>
  selectedMedicationIndex: number
  selectedMedication: Medication | null
}) => {
  const router = useRouter()

  return formOptions({
    defaultValues: {
      medicationName: selectedMedication?.medicationName || '',
      detectedAs: Array.isArray(selectedMedication?.detectedAs) ? selectedMedication?.detectedAs[0] || '' : '',
      startDate: selectedMedication?.startDate || '',
    },
    onSubmit: async ({ value: data, formApi }) => {
      try {
        const result = await editMedicationDetailsAction({
          medicationIndex: selectedMedicationIndex,
          medicationName: data.medicationName,
          detectedAs: data.detectedAs || undefined,
          startDate: data.startDate,
        })

        if (!result.success) {
          throw new Error(result.error || 'Failed to update medication')
        }

        router.refresh()
        setShowDialog(false)
        formApi.reset()
        toast.success('Medication updated successfully!')
      } catch (error) {
        console.error('Error updating medication:', error)
        toast.error(error instanceof Error ? error.message : 'Updating medication failed. Please try again.')
      }
    },
  })
}

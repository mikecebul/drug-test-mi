'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { UpdateMedicationFormType } from '../schemas/medicationSchemas'
import type { Dispatch, SetStateAction } from 'react'
import type { Medication } from '../types'
import { updateMedicationAction } from '../actions'

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
  const router = useRouter()

  return formOptions({
    defaultValues: {
      status: selectedMedication?.status || 'active',
      endDate: selectedMedication?.endDate || '',
    },
    onSubmit: async ({ value: data, formApi }) => {
      try {
        // Use server action to update medication
        const result = await updateMedicationAction({
          medicationIndex: selectedMedicationIndex,
          status: data.status,
          endDate: data.status === 'discontinued' && data.endDate && (typeof data.endDate === 'string' ? data.endDate.trim() !== '' : true) ? data.endDate : undefined,
        })

        if (!result.success) {
          throw new Error(result.error || 'Failed to update medication')
        }

        // Refresh page data
        router.refresh()
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
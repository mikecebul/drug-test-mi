'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { AddMedicationFormType } from '../schemas/medicationSchemas'
import type { Dispatch, SetStateAction } from 'react'
import { addMedicationAction } from '../actions'

const defaultValues: AddMedicationFormType = {
  medicationName: '',
  detectedAs: '',
  startDate: new Date(), // Today's date
}

export const useAddMedicationFormOpts = ({
  setShowDialog,
}: {
  setShowDialog: Dispatch<SetStateAction<boolean>>
}) => {
  const queryClient = useQueryClient()

  return formOptions({
    defaultValues,
    onSubmit: async ({ value: data, formApi }) => {
      try {
        // Use server action to add medication with proper access controls
        const result = await addMedicationAction({
          medicationName: data.medicationName,
          startDate: data.startDate,
          status: 'active',
          ...(data.detectedAs && { detectedAs: data.detectedAs }),
        })

        if (!result.success) {
          throw new Error(result.error || 'Failed to add medication')
        }

        // Refresh dashboard data
        queryClient.invalidateQueries({ queryKey: ['clientDashboard'] })
        setShowDialog(false)
        formApi.reset()
        toast.success('Medication added successfully!')
      } catch (error) {
        console.error('Error adding medication:', error)
        toast.error(
          error instanceof Error ? error.message : 'Adding medication failed. Please try again.',
        )
      }
    },
  })
}

export { defaultValues }
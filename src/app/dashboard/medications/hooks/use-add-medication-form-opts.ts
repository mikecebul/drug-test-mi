'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { AddMedicationFormType } from '../schemas/medicationSchemas'
import type { Dispatch, SetStateAction } from 'react'

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
        const response = await fetch('/api/clients/medications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            medicationName: data.medicationName,
            status: 'active',
            detectedAs: data.detectedAs,
            startDate: data.startDate,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to add medication')
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
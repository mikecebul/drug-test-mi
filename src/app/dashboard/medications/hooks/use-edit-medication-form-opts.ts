'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import type { Medication } from '../types'

interface EditMedicationFormType {
  medicationName: string
  detectedAs: string
  startDate: string
}

export const useEditMedicationFormOpts = ({
  setShowDialog,
  selectedMedicationIndex,
  selectedMedication,
}: {
  setShowDialog: Dispatch<SetStateAction<boolean>>
  selectedMedicationIndex: number
  selectedMedication: Medication | null
}) => {
  const queryClient = useQueryClient()

  return formOptions({
    defaultValues: {
      medicationName: selectedMedication?.medicationName || '',
      detectedAs: selectedMedication?.detectedAs || '',
      startDate: selectedMedication?.startDate || '',
    },
    onSubmit: async ({ value: data, formApi }) => {
      try {
        // First get the current user to get their ID
        const userResponse = await fetch('/api/clients/me', {
          credentials: 'include',
        })

        if (!userResponse.ok) {
          throw new Error('Failed to get user information')
        }

        const { user } = await userResponse.json()
        if (!user) {
          throw new Error('User not authenticated')
        }

        // Get the current client data to update the medications array
        const clientResponse = await fetch(`/api/clients/${user.id}`, {
          credentials: 'include',
        })

        if (!clientResponse.ok) {
          throw new Error('Failed to get client data')
        }

        const clientData = await clientResponse.json()
        const currentMedications = clientData.medications || []

        // Update the specific medication in the array
        const updatedMedications = [...currentMedications]
        updatedMedications[selectedMedicationIndex] = {
          ...updatedMedications[selectedMedicationIndex],
          medicationName: data.medicationName,
          startDate: data.startDate,
          detectedAs: data.detectedAs,
        }

        // Update the client with the modified medications array
        const response = await fetch(`/api/clients/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            medications: updatedMedications,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to update medication')
        }

        // Refresh dashboard data
        queryClient.invalidateQueries({ queryKey: ['clientDashboard'] })
        setShowDialog(false)
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
'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { AddMedicationFormType } from '../schemas/medicationSchemas'
import type { Dispatch, SetStateAction } from 'react'
import { addMedicationAction } from '../actions'
import { safeServerAction } from '@/lib/actions/safeServerAction'

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
  const router = useRouter()

  return formOptions({
    defaultValues,
    onSubmit: async ({ value: data, formApi }) => {
      try {
        // Use server action to add medication with proper access controls
        const result = await safeServerAction(() =>
          addMedicationAction({
          medicationName: data.medicationName,
          startDate: data.startDate,
          status: 'active',
          ...(data.detectedAs && { detectedAs: data.detectedAs }),
          }),
        )

        if (!result.success) {
          throw new Error(result.error || 'Failed to add medication')
        }

        // Refresh page data
        router.refresh()
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

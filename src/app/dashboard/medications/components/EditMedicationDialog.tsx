'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { z } from 'zod'
import type { Medication } from '../types'
import type { Dispatch, SetStateAction } from 'react'
import { DRUG_TEST_SUBSTANCES } from '../types'
import { useEditMedicationFormOpts } from '../hooks/use-edit-medication-form-opts'

interface EditMedicationDialogProps {
  showDialog: boolean
  setShowDialog: Dispatch<SetStateAction<boolean>>
  selectedMedication: Medication | null
  selectedMedicationIndex: number
}

export function EditMedicationDialog({
  showDialog,
  setShowDialog,
  selectedMedication,
  selectedMedicationIndex,
}: EditMedicationDialogProps) {
  const formOpts = useEditMedicationFormOpts({
    setShowDialog,
    selectedMedicationIndex,
    selectedMedication,
  })

  const form = useAppForm(formOpts)

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Medication Details</DialogTitle>
          <DialogDescription>
            {selectedMedication && `Update details for ${selectedMedication.medicationName}`}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <div className="grid gap-4 py-4">
            <form.AppField
              name="medicationName"
              validators={{
                onChange: z.string().min(1, 'Medication name is required'),
              }}
            >
              {(formField) => (
                <formField.TextField
                  label="Medication Name"
                  placeholder="e.g., Adderall XR"
                  required
                />
              )}
            </form.AppField>

            <form.AppField
              name="detectedAs"
              validators={{
                onChange: z.string().optional(),
              }}
            >
              {(formField) => (
                <formField.SelectField
                  label="Detected As (Optional)"
                  options={DRUG_TEST_SUBSTANCES}
                />
              )}
            </form.AppField>

            <form.AppField
              name="startDate"
              validators={{
                onChange: z
                  .union([
                    z.date(),
                    z
                      .string()
                      .min(1, 'Start date is required')
                      .transform((str) => new Date(str)),
                  ])
                  .refine((date) => !isNaN(date.getTime()), {
                    message: 'Invalid date format',
                  })
                  .refine(
                    (date) => {
                      const maxFutureDate = new Date()
                      maxFutureDate.setMonth(maxFutureDate.getMonth() + 2)
                      return date <= maxFutureDate
                    },
                    {
                      message: 'Start date cannot be more than 2 months in the future',
                    },
                  ),
              }}
            >
              {(formField) => (
                <formField.DateField
                  label="Start Date"
                  placeholder="Select start date"
                  description="When you started taking this medication"
                  maxDate={new Date(new Date().setMonth(new Date().getMonth() + 2))}
                  required
                />
              )}
            </form.AppField>
          </div>

          <DialogFooter className="flex w-full sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton label="Update Details" className="w-fit" />
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
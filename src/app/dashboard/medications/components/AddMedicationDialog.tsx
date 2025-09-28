'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useAddMedicationFormOpts } from '../hooks/use-add-medication-form-opts'
import { DRUG_TEST_SUBSTANCES } from '../types'
import { z } from 'zod'

interface AddMedicationDialogProps {
  buttonText?: string
}

export function AddMedicationDialog({ buttonText = 'Add Medication' }: AddMedicationDialogProps) {
  const [showDialog, setShowDialog] = useState(false)

  const formOpts = useAddMedicationFormOpts({ setShowDialog })
  const form = useAppForm(formOpts)

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
          <DialogDescription>
            Add a new medication to your documented list for drug test verification.
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
                  description="Provide your best guess if you started this medication long ago"
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
              <form.SubmitButton label="Add Medication" className="w-fit" />
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

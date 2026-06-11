'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
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
    <Drawer direction="right" open={showDialog} onOpenChange={setShowDialog}>
      <DrawerTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(36rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
        <DrawerHeader className="border-border border-b px-6 py-5">
          <DrawerTitle className="text-2xl tracking-tight">Add New Medication</DrawerTitle>
          <DrawerDescription>
            Add a new medication to your documented list for drug test verification.
          </DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="no-scrollbar grid flex-1 gap-4 overflow-y-auto px-6 py-5">
            <form.AppField
              name="medicationName"
              validators={{
                onChange: z.string().min(1, 'Medication name is required'),
              }}
            >
              {(formField) => <formField.TextField label="Medication Name" placeholder="e.g., Adderall XR" required />}
            </form.AppField>

            <form.AppField
              name="detectedAs"
              validators={{
                onChange: z.string().optional(),
              }}
            >
              {(formField) => <formField.SelectField label="Detected As (Optional)" options={DRUG_TEST_SUBSTANCES} />}
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
          <DrawerFooter className="border-border border-t px-6 py-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton label="Add Medication" className="w-fit" />
            </form.AppForm>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

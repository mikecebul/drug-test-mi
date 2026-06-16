'use client'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useUpdateMedicationFormOpts } from '../hooks/use-update-medication-form-opts'
import { z } from 'zod'
import type { Medication } from '../types'
import type { Dispatch, SetStateAction } from 'react'
import { MEDICATION_STATUS_OPTIONS } from '../types'

interface UpdateMedicationStatusDialogProps {
  showDialog: boolean
  setShowDialog: Dispatch<SetStateAction<boolean>>
  selectedMedication: Medication | null
  setSelectedMedication: Dispatch<SetStateAction<Medication | null>>
  selectedMedicationIndex: number
}

export function UpdateMedicationStatusDialog({
  showDialog,
  setShowDialog,
  selectedMedication,
  setSelectedMedication,
  selectedMedicationIndex,
}: UpdateMedicationStatusDialogProps) {
  const formOpts = useUpdateMedicationFormOpts({
    setShowDialog,
    setSelectedMedication,
    selectedMedicationIndex,
    selectedMedication,
  })
  const form = useAppForm(formOpts)

  return (
    <Drawer direction="right" open={showDialog} onOpenChange={setShowDialog}>
      <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(34rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
        <DrawerHeader className="border-border border-b px-6 py-5">
          <DrawerTitle className="text-2xl tracking-tight">Update Medication Status</DrawerTitle>
          <DrawerDescription>
            {selectedMedication && `Update status for ${selectedMedication.medicationName}`}
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
              name="status"
              validators={{
                onChange: z.enum(['active', 'discontinued']),
              }}
            >
              {(formField) => <formField.SelectField label="Status" required options={MEDICATION_STATUS_OPTIONS} />}
            </form.AppField>

            <form.AppField
              name="endDate"
              validators={{
                onChangeListenTo: ['status'],
                onChange: ({ value, fieldApi }) => {
                  const status = fieldApi.form.getFieldValue('status')
                  if (status === 'discontinued' && !value) {
                    return 'End date is required when discontinuing medication'
                  }

                  if (value) {
                    const date = value instanceof Date ? value : new Date(value)
                    if (!isNaN(date.getTime())) {
                      // Check future date limit (2 months)
                      const maxFutureDate = new Date()
                      maxFutureDate.setMonth(maxFutureDate.getMonth() + 2)
                      if (date > maxFutureDate) {
                        return 'End date cannot be more than 2 months in the future'
                      }

                      // Check past date limit (2 months)
                      const minPastDate = new Date()
                      minPastDate.setMonth(minPastDate.getMonth() - 2)
                      if (date < minPastDate) {
                        return 'End date cannot be more than 2 months in the past. For larger changes, contact support: (231) 373-6341 or mike@midrugtest.com'
                      }

                      // Check against start date
                      if (selectedMedication?.startDate) {
                        const startDate = new Date(selectedMedication.startDate)
                        if (!isNaN(startDate.getTime()) && date < startDate) {
                          return 'End date cannot be before the medication start date'
                        }
                      }
                    }
                  }

                  return undefined
                },
              }}
            >
              {(formField) => {
                const status = form.getFieldValue('status')
                const isDiscontinued = status === 'discontinued'

                // Calculate date limits
                const maxFutureDate = new Date()
                maxFutureDate.setMonth(maxFutureDate.getMonth() + 2)

                const minPastDate = new Date()
                minPastDate.setMonth(minPastDate.getMonth() - 2)

                // Use start date as minimum if it's more recent than 2 months ago
                const startDate = selectedMedication?.startDate ? new Date(selectedMedication.startDate) : null
                const effectiveMinDate = startDate && startDate > minPastDate ? startDate : minPastDate

                return (
                  <formField.DatePickerField
                    label="End Date"
                    placeholder="Select end date"
                    description={
                      isDiscontinued
                        ? 'Required when discontinuing medication'
                        : 'Only required when discontinuing medication'
                    }
                    disabled={!isDiscontinued}
                    required={isDiscontinued}
                    minDate={effectiveMinDate}
                    maxDate={maxFutureDate}
                  />
                )
              }}
            </form.AppField>
          </div>

          <DrawerFooter className="border-border border-t px-6 py-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton label="Update Status" className="w-fit" />
            </form.AppForm>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

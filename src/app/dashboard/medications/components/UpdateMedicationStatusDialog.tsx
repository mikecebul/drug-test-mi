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
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Medication Status</DialogTitle>
          <DialogDescription>
            {selectedMedication && `Update status for ${selectedMedication.medicationName}`}
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
              name="status"
              validators={{
                onChange: z.enum(['active', 'discontinued']),
              }}
            >
              {(formField) => (
                <formField.SelectField
                  label="Status"
                  required
                  options={MEDICATION_STATUS_OPTIONS}
                />
              )}
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
                  <formField.DateField
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

          <DialogFooter className="flex w-full sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton label="Update Status" className="w-fit" />
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

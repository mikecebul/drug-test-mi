'use client'

import { useRef } from 'react'
import { revalidateLogic } from '@tanstack/react-form'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { allSubstanceOptions } from '@/fields/substanceOptions'
import { focusFirstInvalidFieldWithToast } from '@/lib/form-scroll-focus'
import { confirmationReviewRowSchema, type ConfirmationReviewRow } from '../components/confirmation-review'

const subjects = allSubstanceOptions.filter((option) => option.value !== 'none')
const choices = [
  { label: 'Confirmed Negative', value: 'confirmed-negative' },
  { label: 'Confirmed Positive', value: 'confirmed-positive' },
  { label: 'Inconclusive', value: 'inconclusive' },
]

/** A staged row edit: only a validated Apply changes the parent workflow's array. */
export function ConfirmationResultDialog({
  value,
  onApply,
  onClose,
}: {
  value: ConfirmationReviewRow
  onApply: (value: ConfirmationReviewRow) => void
  onClose: () => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const form = useAppForm({
    defaultValues: value,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: confirmationReviewRowSchema },
    onSubmitInvalid: () => focusFirstInvalidFieldWithToast(formRef.current, 'confirmation-result-invalid'),
    onSubmit: ({ value }) => onApply(value),
  })
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined} className="staff-interface">
        <DialogHeader>
          <DialogTitle>Review confirmation result</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="substance">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="confirmation-substance">Substance</FieldLabel>
                  <Select
                    items={subjects}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? '')}
                  >
                    <SelectTrigger
                      id="confirmation-substance"
                      name={field.name}
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby="confirmation-substance-error"
                    >
                      <SelectValue placeholder="Select substance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {subjects.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError id="confirmation-substance-error" errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="result">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="confirmation-result">Confirmation result</FieldLabel>
                  <Select
                    items={choices}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange((value ?? '') as ConfirmationReviewRow['result'])}
                  >
                    <SelectTrigger
                      id="confirmation-result"
                      name={field.name}
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby="confirmation-result-error"
                    >
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {choices.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError id="confirmation-result-error" errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="notes">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="confirmation-notes">Notes</FieldLabel>
                  <Textarea
                    id="confirmation-notes"
                    name={field.name}
                    value={field.state.value ?? ''}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                  />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Use result</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

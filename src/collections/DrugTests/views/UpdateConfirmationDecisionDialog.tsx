'use client'

import { useMemo, useState } from 'react'

import { useStore, formOptions } from '@tanstack/react-form'
import { AlertTriangle, Loader2, PencilLine } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useAppForm } from '@/blocks/Form/hooks/form'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { Badge } from '@/components/ui/badge'
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
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { formatSubstance } from '@/lib/substances'
import { cn } from '@/utilities/cn'

type ConfirmationDecision = 'pending-decision' | 'accept' | 'request-confirmation'

type ConfirmationDecisionFormValues = {
  confirmationDecision: ConfirmationDecision
  confirmationSubstances: string[]
}

type UpdateConfirmationDecisionDialogProps = {
  drugTestId: string
  initialDecision: 'pending-decision' | 'accept' | 'request-confirmation' | null
  initialConfirmationSubstances: string[]
  unexpectedPositives: string[]
}

function normalizeSubstances(items: string[]): string[] {
  const unique = new Set<string>()

  for (const item of items) {
    if (typeof item !== 'string') continue

    const trimmed = item.trim()
    if (trimmed.length > 0) {
      unique.add(trimmed)
    }
  }

  return [...unique]
}

function getPayloadErrorMessage(errorPayload: unknown): string {
  if (typeof errorPayload !== 'object' || errorPayload === null) {
    return 'Failed to update confirmation decision.'
  }

  const payloadError = errorPayload as {
    message?: unknown
    error?: unknown
    errors?: Array<{ message?: unknown }>
  }

  if (typeof payloadError.message === 'string' && payloadError.message.trim().length > 0) {
    return payloadError.message
  }

  if (typeof payloadError.error === 'string' && payloadError.error.trim().length > 0) {
    return payloadError.error
  }

  if (Array.isArray(payloadError.errors) && payloadError.errors.length > 0) {
    const first = payloadError.errors[0]
    if (first && typeof first.message === 'string' && first.message.trim().length > 0) {
      return first.message
    }
  }

  return 'Failed to update confirmation decision.'
}

export function UpdateConfirmationDecisionDialog({
  drugTestId,
  initialDecision,
  initialConfirmationSubstances,
  unexpectedPositives,
}: UpdateConfirmationDecisionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const normalizedUnexpectedPositives = useMemo(
    () => normalizeSubstances(unexpectedPositives),
    [unexpectedPositives],
  )

  const normalizedInitialSubstances = useMemo(
    () =>
      normalizeSubstances(initialConfirmationSubstances).filter((substance) =>
        normalizedUnexpectedPositives.includes(substance),
      ),
    [initialConfirmationSubstances, normalizedUnexpectedPositives],
  )

  const startingDecision: ConfirmationDecision = initialDecision ?? 'pending-decision'

  const form = useAppForm(
    formOptions({
      defaultValues: {
        confirmationDecision: startingDecision,
        confirmationSubstances: normalizedInitialSubstances,
      } as ConfirmationDecisionFormValues,
      onSubmit: async ({ value, formApi }) => {
        const formValue = value as ConfirmationDecisionFormValues

        try {
          const response = await fetch(`/api/drug-tests/${drugTestId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              confirmationDecision: formValue.confirmationDecision,
              confirmationSubstances:
                formValue.confirmationDecision === 'request-confirmation'
                  ? formValue.confirmationSubstances
                  : [],
            }),
          })

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => null)
            throw new Error(getPayloadErrorMessage(errorPayload))
          }

          toast.success('Confirmation decision updated.')
          setOpen(false)
          formApi.reset()
          router.refresh()
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : 'Unable to update confirmation decision. Please try again.'
          toast.error(message)
        }
      },
    }),
  )

  const formValues = useStore(form.store, (state: any) => state.values as ConfirmationDecisionFormValues)
  const isSubmitting = useStore(form.store, (state: any) => Boolean(state.isSubmitting))
  const confirmationDecisionValue = formValues.confirmationDecision

  const handleConfirmationDecisionChange = (value: ConfirmationDecision) => {
    form.setFieldValue('confirmationDecision', value)

    if (value === 'request-confirmation') {
      const currentSubstances = (form.getFieldValue('confirmationSubstances') as string[] | undefined) ?? []
      if (currentSubstances.length === 0) {
        form.setFieldValue('confirmationSubstances', normalizedUnexpectedPositives)
      }
    }

    // Ensure submit-mode errors clear immediately after user correction.
    form.validate('submit')
  }

  const handleDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (nextOpen) {
      form.setFieldValue('confirmationDecision', startingDecision)
      form.setFieldValue('confirmationSubstances', normalizedInitialSubstances)
      return
    }

    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <PencilLine className="h-4 w-4" />
          Update Confirmation Decision
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update Confirmation Decision</DialogTitle>
          <DialogDescription>
            Use the same confirmation workflow options used in the screening wizard.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-5"
        >
          <div className="border-warning/50 bg-warning-muted/50 w-full rounded-xl border p-6 shadow-md">
            <div className="mb-6">
              <div className="flex items-center gap-2.5">
                <div className="bg-warning/20 flex h-8 w-8 items-center justify-center rounded-full">
                  <AlertTriangle className="text-warning h-4 w-4" />
                </div>
                <h3 className="text-foreground text-xl font-semibold">Confirmation Decision Required</h3>
              </div>
              <p className="text-warning-foreground mt-2 text-sm">
                Unexpected positive substances detected. Choose how to proceed.
              </p>
            </div>

            <div className="mb-5">
              <p className="text-muted-foreground mb-2 text-sm font-medium">Unexpected Positives:</p>
              <div className="flex flex-wrap gap-2">
                {normalizedUnexpectedPositives.map((substance) => (
                  <Badge key={substance} variant="destructive">
                    {formatSubstance(substance)}
                  </Badge>
                ))}
              </div>
            </div>

            <form.Field
              name="confirmationDecision"
              validators={{
                onSubmit: ({ value }) => {
                  if (!value) {
                    return 'Select a confirmation decision.'
                  }
                  return undefined
                },
              }}
            >
              {(field) => {
                const errors = field.state.meta.errors
                const hasErrors = errors.length > 0

                return (
                  <Field data-invalid={hasErrors}>
                    <FieldLabel>How would you like to proceed?</FieldLabel>
                    <FieldDescription>This updates the workflow decision on this drug test record.</FieldDescription>
                    <RadioGroup
                      value={confirmationDecisionValue || ''}
                      onValueChange={(value) => handleConfirmationDecisionChange(value as ConfirmationDecision)}
                      className="space-y-2.5"
                      aria-invalid={hasErrors || undefined}
                    >
                      <Label
                        htmlFor="summary-decision-accept"
                        className={cn(
                          'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                          confirmationDecisionValue === 'accept' && 'border-foreground/50 ring-foreground/20 ring-2',
                        )}
                      >
                        <RadioGroupItem value="accept" id="summary-decision-accept" className="mt-0.5" />
                        <div className="flex-1">
                          <span className="text-foreground font-medium">Accept Results</span>
                          <p className="text-muted-foreground mt-0.5 text-sm">
                            Accept the screening results as final. Sample will be disposed.
                          </p>
                        </div>
                      </Label>

                      <Label
                        htmlFor="summary-decision-request-confirmation"
                        className={cn(
                          'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                          confirmationDecisionValue === 'request-confirmation' &&
                            'border-foreground/50 ring-foreground/20 ring-2',
                        )}
                      >
                        <RadioGroupItem
                          value="request-confirmation"
                          id="summary-decision-request-confirmation"
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-foreground font-medium">Request Confirmation Testing</span>
                          <p className="text-muted-foreground mt-0.5 text-sm">
                            Send sample to lab for LC-MS/MS confirmation testing on selected substances.
                          </p>
                        </div>
                      </Label>

                      <Label
                        htmlFor="summary-decision-pending"
                        className={cn(
                          'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                          confirmationDecisionValue === 'pending-decision' &&
                            'border-foreground/50 ring-foreground/20 ring-2',
                        )}
                      >
                        <RadioGroupItem value="pending-decision" id="summary-decision-pending" className="mt-0.5" />
                        <div className="flex-1">
                          <span className="text-foreground font-medium">Pending Decision</span>
                          <p className="text-muted-foreground mt-0.5 text-sm">
                            Decision not yet made. Sample will be held for 30 days. $30/substance.
                          </p>
                        </div>
                      </Label>
                    </RadioGroup>
                    <FieldError errors={errors} />
                  </Field>
                )
              }}
            </form.Field>

            {confirmationDecisionValue === 'request-confirmation' && (
              <form.Field
                name="confirmationSubstances"
                validators={{
                  onSubmit: ({ value, fieldApi }) => {
                    const decision = fieldApi.form.getFieldValue('confirmationDecision')
                    const selected = Array.isArray(value) ? value : []

                    if (decision === 'request-confirmation' && selected.length === 0) {
                      return 'Select at least one substance for confirmation testing.'
                    }
                    return undefined
                  },
                }}
              >
                {(field) => (
                  <Field className="mt-5" data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel>Confirmation Substances</FieldLabel>
                    <ConfirmationSubstanceSelector
                      unexpectedPositives={normalizedUnexpectedPositives}
                      selectedSubstances={Array.isArray(field.state.value) ? field.state.value : []}
                      onSelectionChange={(substances) => {
                        field.handleChange(substances)
                        form.validate('submit')
                      }}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Decision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useRef, useState } from 'react'
import { revalidateLogic, useStore } from '@tanstack/react-form'
import { Clock4, Loader2, PencilLine, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { focusFirstInvalidFieldWithToast } from '@/lib/form-scroll-focus'
import { cn } from '@/utilities/cn'
import { confirmationDecisionFormSchema, type ConfirmationDecisionFormValues } from '../confirmation/decisionForm'
import { updateConfirmationDecision } from './actions'

type Props = {
  drugTestId: string
  isLabTest: boolean
  initialDecision: ConfirmationDecisionFormValues['confirmationDecision'] | null
  initialConfirmationSubstances: string[]
  unexpectedPositives: string[]
}

export function UpdateConfirmationDecisionDialog({
  drugTestId,
  isLabTest,
  initialDecision,
  initialConfirmationSubstances,
  unexpectedPositives,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const defaultValues: ConfirmationDecisionFormValues = {
    confirmationDecision: initialDecision ?? 'pending-decision',
    confirmationSubstances: [...new Set(initialConfirmationSubstances)],
  }
  const substances = [...new Set([...unexpectedPositives, ...initialConfirmationSubstances])]
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: confirmationDecisionFormSchema },
    onSubmitInvalid: () => focusFirstInvalidFieldWithToast(formRef.current, 'summary-decision-invalid'),
    onSubmit: async ({ value }) => {
      try {
        const result = await updateConfirmationDecision(drugTestId, value)
        if (!result.success) throw new Error(result.error)
        toast.success('Confirmation decision updated.')
        setOpen(false)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to update the decision. Please try again.')
      }
    },
  })
  const decision = useStore(form.store, (state) => state.values.confirmationDecision)
  const submitting = useStore(form.store, (state) => state.isSubmitting)
  const options = [
    { value: 'accept', title: 'Accept result', description: 'Finish this test. Stop tracking it.' },
    {
      value: 'request-confirmation',
      title: 'Request confirmation',
      description: `$${isLabTest ? 45 : 30} per substance. Arrange payment before the lab request.`,
    },
    {
      value: 'pending-decision',
      title: 'Decide later',
      description: isLabTest
        ? 'Track for 30 days from the screening result date.'
        : 'Request before specimen disposal.',
    },
  ] as const
  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting) return
        if (nextOpen) form.reset(defaultValues)
        setOpen(nextOpen)
      }}
      swipeDirection="right"
    >
      <DrawerTrigger render={<Button type="button" variant="outline-primary" size="sm" />}>
        <PencilLine data-icon="inline-start" />
        Update decision
      </DrawerTrigger>
      <DrawerContent
        aria-describedby={undefined}
        className="staff-interface data-[swipe-axis=x]:w-full data-[swipe-axis=x]:sm:w-[min(90vw,38rem)]"
      >
        <DrawerHeader className="flex-row items-center justify-between gap-3 border-b">
          <DrawerTitle>Update decision</DrawerTitle>
          <DrawerClose
            render={
              <Button type="button" variant="ghost" size="icon" aria-label="Close decision" disabled={submitting} />
            }
          >
            <X />
          </DrawerClose>
        </DrawerHeader>
        <form
          ref={formRef}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldGroup className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <form.Field name="confirmationDecision">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel id="summary-decision-label">Result decision</FieldLabel>
                  <RadioGroup
                    name={field.name}
                    value={field.state.value}
                    aria-labelledby="summary-decision-label"
                    aria-invalid={field.state.meta.errors.length > 0}
                    disabled={submitting}
                    onValueChange={(value) => {
                      field.handleChange(value as ConfirmationDecisionFormValues['confirmationDecision'])
                      if (value === 'request-confirmation' && !form.getFieldValue('confirmationSubstances').length)
                        form.setFieldValue('confirmationSubstances', substances)
                    }}
                  >
                    {options.map((option) => (
                      <Label
                        key={option.value}
                        htmlFor={`summary-decision-${option.value}`}
                        className={cn(
                          'border-border bg-card flex cursor-pointer items-start gap-3 rounded-lg border p-4',
                          decision === option.value && 'border-primary bg-primary/5',
                        )}
                      >
                        <RadioGroupItem
                          value={option.value}
                          id={`summary-decision-${option.value}`}
                          className="mt-0.5"
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span>{option.title}</span>
                          <span className="text-muted-foreground text-sm font-normal">{option.description}</span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="confirmationSubstances">
              {(field) =>
                decision === 'request-confirmation' && (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel id="summary-substances-label" className="sr-only">
                      Confirm substances
                    </FieldLabel>
                    <ConfirmationSubstanceSelector
                      invalid={field.state.meta.errors.length > 0}
                      compact
                      unexpectedPositives={substances}
                      selectedSubstances={field.state.value}
                      onSelectionChange={field.handleChange}
                      disabled={submitting}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }
            </form.Field>
            {decision === 'request-confirmation' && (
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <Clock4 className="size-4 shrink-0" aria-hidden />
                Final results are pending until confirmation is completed.
              </p>
            )}
          </FieldGroup>
          <DrawerFooter className="flex-row justify-end border-t">
            <DrawerClose render={<Button type="button" variant="outline" disabled={submitting} />}>Cancel</DrawerClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 data-icon="inline-start" className="animate-spin" />}Save decision
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

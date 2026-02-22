'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import InputDateTimePicker from '@/components/input-datetime-picker'
import { MedicationDisplayField, FieldGroupHeader, HeadshotCaptureCard } from '../../components'
import { getInstantTestFormOpts } from '../shared-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldError, FieldLegend } from '@/components/ui/field'
import { useComputeTestResultPreviewQuery, invalidateWizardClientDerivedData } from '../../../queries'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { cn } from '@/utilities/cn'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export const VerifyDataStep = withForm({
  ...getInstantTestFormOpts('verifyData'),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const formValues = useStore(form.store, (state) => state.values)
    const formClient = formValues.client
    const verifyData = formValues.verifyData
    const medications = formValues.medications

    // Convert form client to SimpleClient type with derived fields
    const client = formClient?.id
      ? {
          ...formClient,
          middleInitial: formClient.middleInitial ?? undefined,
          dob: formClient.dob ?? undefined,
          headshot: formClient.headshot ?? undefined,
          headshotId: formClient.headshotId ?? undefined,
          fullName: formClient.middleInitial
            ? `${formClient.firstName} ${formClient.middleInitial} ${formClient.lastName}`
            : `${formClient.firstName} ${formClient.lastName}`,
          initials: `${formClient.firstName.charAt(0)}${formClient.lastName.charAt(0)}`,
        }
      : undefined

    // Compute test result preview to detect unexpected positives
    const { data: preview } = useComputeTestResultPreviewQuery(
      client?.id,
      (verifyData?.detectedSubstances ?? []) as SubstanceValue[],
      verifyData?.testType ?? '15-panel-instant',
      verifyData?.breathalyzerTaken,
      verifyData?.breathalyzerResult,
      medications, // Pass medications to properly compute expected vs unexpected positives
    )

    const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
    const requiresDecision = hasUnexpectedPositives && !preview?.autoAccept

    // Clear error if no decision required
    useEffect(() => {
      if (requiresDecision === true) {
        form.setFieldValue('verifyData.confirmationDecisionRequired', true)
        form.validate('submit')
      }
      if (requiresDecision === false) {
        form.setFieldValue('verifyData.confirmationDecisionRequired', false)
        form.validate('submit')
      }
    }, [requiresDecision, form])

    // Get confirmation decision from form state
    const confirmationDecisionValue = verifyData?.confirmationDecision
    const confirmationSubstancesValue = verifyData?.confirmationSubstances ?? []

    // Handler for confirmation decision changes
    const handleConfirmationDecisionChange = (value: 'accept' | 'request-confirmation' | 'pending-decision') => {
      form.setFieldValue('verifyData.confirmationDecision', value)

      // Auto-populate confirmation substances when requesting confirmation
      if (value === 'request-confirmation' && preview?.unexpectedPositives) {
        const currentSubstances = confirmationSubstancesValue || []
        if (currentSubstances.length === 0) {
          form.setFieldValue('verifyData.confirmationSubstances', preview.unexpectedPositives)
        }
      }

      // Ensure submit-mode errors clear immediately after user correction.
      form.validate('submit')
    }

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Verify Test Data"
          description="Review and adjust the extracted data before creating the test record"
        />

        {/* Client Info & Medications */}
        {client && (
          <HeadshotCaptureCard
            client={client}
            onHeadshotLinked={(url: string, docId: string) => {
              form.setFieldValue('client.headshot', url)
              form.setFieldValue('client.headshotId', docId)
              invalidateWizardClientDerivedData(queryClient, { clientId: client.id })
            }}
          />
        )}

        {medications.length > 0 && <MedicationDisplayField medications={medications} />}

        {/* Test Data Form */}
        <Card className="@container shadow-md">
          <CardContent className="grid gap-6 pt-6">
            {/* Test Type (read-only for instant tests) */}
            <FieldGroup className="grid @lg:grid-cols-2">
              <Field className="@lg:col-span-1">
                <FieldLabel>Test Type</FieldLabel>
                <Input value="15-Panel Instant" disabled readOnly />
              </Field>
            </FieldGroup>

            {/* Collection Date/Time */}
            <FieldGroup className="grid @lg:grid-cols-2">
              <form.Field name="verifyData.collectionDate">
                {(field) => (
                  <Field className="@lg:col-span-1">
                    <FieldLabel htmlFor="collectionDate">Collection Date &amp; Time</FieldLabel>
                    <InputDateTimePicker
                      id="collectionDate"
                      value={field.state.value ? new Date(field.state.value) : undefined}
                      onChange={(value) => field.handleChange(value?.toISOString() ?? '')}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>

            {/* Detected Substances */}
            <form.AppField
              name="verifyData.detectedSubstances"
              listeners={{
                onChange: () => {
                  // Reset confirmation decision when detected substances change
                  // This ensures the user makes a fresh decision when test results change
                  if (confirmationDecisionValue) {
                    form.setFieldValue('verifyData.confirmationDecision', undefined)
                    form.setFieldValue('verifyData.confirmationSubstances', [])
                  }
                },
              }}
            >
              {(field) => <field.SubstanceChecklistField />}
            </form.AppField>

            {/* Dilute Sample */}
            <Field orientation="horizontal">
              <form.Field name="verifyData.isDilute">
                {(field) => (
                  <Checkbox
                    id="isDilute"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                  />
                )}
              </form.Field>
              <FieldLabel htmlFor="isDilute" className="cursor-pointer font-normal">
                Sample is Dilute
              </FieldLabel>
            </Field>

            {/* Breathalyzer Section */}
            <div className="bg-muted/50 border-border space-y-4 rounded-lg border p-4">
              <FieldLegend>Breathalyzer Test (Optional)</FieldLegend>
              <Field orientation="horizontal">
                <form.Field name="verifyData.breathalyzerTaken">
                  {(field) => (
                    <Checkbox
                      id="breathalyzerTaken"
                      checked={field.state.value}
                      onCheckedChange={(checked) => {
                        field.handleChange(checked as boolean)
                        // Clear result when unchecking - validation errors clear automatically
                        if (!checked) {
                          form.setFieldValue('verifyData.breathalyzerResult', null)
                        }
                      }}
                    />
                  )}
                </form.Field>
                <FieldLabel htmlFor="breathalyzerTaken" className="cursor-pointer font-normal">
                  Breathalyzer test was administered
                </FieldLabel>
              </Field>

              {verifyData?.breathalyzerTaken && (
                <form.Field name="verifyData.breathalyzerResult">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="breathalyzerResult">
                        BAC Result <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="breathalyzerResult"
                        type="number"
                        step="0.001"
                        value={field.state.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value)
                          field.handleChange(value)
                        }}
                        placeholder="0.000"
                      />
                      <p className="text-muted-foreground text-xs">
                        Enter result with 3 decimal places. Threshold: 0.000 (any detectable alcohol = positive)
                      </p>
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Decision Section - only show when there are unexpected positives */}
        {requiresDecision && (
          <div className="border-warning/50 bg-warning-muted/50 w-full rounded-xl border p-6 shadow-md">
            {/* Header */}
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

            {/* Unexpected Positives */}
            <div className="mb-5">
              <p className="text-muted-foreground mb-2 text-sm font-medium">Unexpected Positives:</p>
              <div className="flex flex-wrap gap-2">
                {preview?.unexpectedPositives?.map((substance) => (
                  <Badge key={substance} variant="destructive">
                    {formatSubstance(substance)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Decision Options */}
            <form.Field name="verifyData.confirmationDecision">
              {(field) => (
                <Field>
                  <FieldLabel>How would you like to proceed?</FieldLabel>
                  <RadioGroup
                    value={confirmationDecisionValue || ''}
                    onValueChange={(value) =>
                      handleConfirmationDecisionChange(value as 'accept' | 'request-confirmation' | 'pending-decision')
                    }
                    className="space-y-2.5"
                  >
                    <Label
                      htmlFor="accept"
                      className={cn(
                        'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                        confirmationDecisionValue === 'accept' && 'border-foreground/50 ring-foreground/20 ring-2',
                      )}
                    >
                      <RadioGroupItem value="accept" id="accept" className="mt-0.5" />
                      <div className="flex-1">
                        <span className="text-foreground font-medium">Accept Results</span>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          Accept the screening results as final. Sample will be disposed.
                        </p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="request-confirmation"
                      className={cn(
                        'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                        confirmationDecisionValue === 'request-confirmation' &&
                          'border-foreground/50 ring-foreground/20 ring-2',
                      )}
                    >
                      <RadioGroupItem value="request-confirmation" id="request-confirmation" className="mt-0.5" />
                      <div className="flex-1">
                        <span className="text-foreground font-medium">Request Confirmation Testing</span>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          Send sample to lab for LC-MS/MS confirmation testing on selected substances.
                        </p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="pending-decision"
                      className={cn(
                        'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                        confirmationDecisionValue === 'pending-decision' &&
                          'border-foreground/50 ring-foreground/20 ring-2',
                      )}
                    >
                      <RadioGroupItem value="pending-decision" id="pending-decision" className="mt-0.5" />
                      <div className="flex-1">
                        <span className="text-foreground font-medium">Pending Decision</span>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          Decision not yet made. Sample will be held for 30 days. $30/substance.
                        </p>
                      </div>
                    </Label>
                  </RadioGroup>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            {/* Substance selection when request-confirmation is chosen */}
            {confirmationDecisionValue === 'request-confirmation' && (
              <form.Field name="verifyData.confirmationSubstances">
                {(field) => (
                  <div className="mt-5">
                    <ConfirmationSubstanceSelector
                      unexpectedPositives={preview?.unexpectedPositives ?? []}
                      selectedSubstances={confirmationSubstancesValue ?? []}
                      onSelectionChange={(substances) => {
                        form.setFieldValue('verifyData.confirmationSubstances', substances)
                        form.validate('submit')
                      }}
                      error={field.state.meta.errors?.[0]?.message}
                    />
                  </div>
                )}
              </form.Field>
            )}
          </div>
        )}
      </div>
    )
  },
})

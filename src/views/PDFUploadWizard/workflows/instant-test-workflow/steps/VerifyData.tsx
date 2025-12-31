'use client'

import { useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import InputDateTimePicker from '@/components/input-datetime-picker'
import { ClientInfoCard, MedicationDisplayField, FieldGroupHeader } from '../../components'
import { getInstantTestFormOpts } from '../shared-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldError, FieldLegend } from '@/components/ui/field'
import { useExtractPdfQuery, useGetClientMedicationsQuery, useComputeTestResultPreviewQuery } from '../../../queries'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { cn } from '@/utilities/cn'
import { AlertTriangle } from 'lucide-react'

export const VerifyDataStep = withForm({
  ...getInstantTestFormOpts('verifyData'),

  render: function Render({ form }) {
    // Get form values
    const formValues = useStore(form.store, (state) => state.values)
    const client = formValues.client
    const verifyData = formValues.verifyData
    const uploadedFile = formValues.upload.file
    const medications = formValues.medications

    // Get extracted data from query (cached from ExtractStep)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, '15-panel-instant')

    // Fetch client medications
    // const medicationsQuery = useGetClientMedicationsQuery(client?.id)
    // const clientMedications = medicationsQuery.data?.medications ?? []

    // Initialize form with extracted data
    useEffect(() => {
      if (extractData?.collectionDate) {
        form.setFieldValue('verifyData.collectionDate', extractData.collectionDate)
      }
      if (extractData?.detectedSubstances) {
        form.setFieldValue('verifyData.detectedSubstances', extractData.detectedSubstances)
      }
      if (extractData?.isDilute !== undefined) {
        form.setFieldValue('verifyData.isDilute', extractData.isDilute)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extractData])

    // Compute test result preview to detect unexpected positives
    const previewQuery = useComputeTestResultPreviewQuery(
      client?.id,
      (verifyData?.detectedSubstances ?? []) as SubstanceValue[],
      verifyData?.testType ?? '15-panel-instant',
      verifyData?.breathalyzerTaken,
      verifyData?.breathalyzerResult,
    )
    const preview = previewQuery.data
    const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
    const requiresDecision = hasUnexpectedPositives && !preview?.autoAccept

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
    }

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Verify Test Data"
          description="Review and adjust the extracted data before creating the test record"
        />

        {/* Client Info & Medications */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <ClientInfoCard client={client} />
          {medications.length > 0 && <MedicationDisplayField medications={medications} />}
        </div>

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
                    form.setFieldValue('verifyData.confirmationDecision', null)
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
                      onCheckedChange={(checked) => field.handleChange(checked as boolean)}
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
                        min="0"
                        max="1"
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
            <div>
              <p className="text-muted-foreground mb-3 text-sm font-medium">How would you like to proceed?</p>
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
            </div>

            {/* Substance selection when request-confirmation is chosen */}
            {confirmationDecisionValue === 'request-confirmation' && (
              <div className="mt-5">
                <ConfirmationSubstanceSelector
                  unexpectedPositives={preview?.unexpectedPositives ?? []}
                  selectedSubstances={confirmationSubstancesValue ?? []}
                  onSelectionChange={(substances) =>
                    form.setFieldValue('verifyData.confirmationSubstances', substances)
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
})

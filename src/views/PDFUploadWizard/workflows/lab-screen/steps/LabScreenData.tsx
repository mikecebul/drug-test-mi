'use client'

import { useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import InputDateTimePicker from '@/components/input-datetime-picker'
import { ClientInfoCard, MedicationDisplayField, FieldGroupHeader } from '../../components'
import { getLabScreenFormOpts } from '../shared-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldError, FieldLegend } from '@/components/ui/field'
import {
  useExtractPdfQuery,
  useGetClientMedicationsQuery,
  useComputeTestResultPreviewQuery,
  useGetClientFromTestQuery,
} from '../../../queries'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { cn } from '@/utilities/cn'
import { AlertTriangle } from 'lucide-react'

export const LabScreenDataStep = withForm({
  ...getLabScreenFormOpts('labScreenData'),

  render: function Render({ form }) {
    const formValues = useStore(form.store, (state) => state.values)
    const matchCollection = formValues.matchCollection
    const labScreenData = formValues.labScreenData
    const uploadedFile = formValues.upload.file

    // Fetch client from matched test
    const { data: client } = useGetClientFromTestQuery(matchCollection?.testId)

    // Fetch client medications
    const medicationsQuery = useGetClientMedicationsQuery(client?.id)
    const clientMedications = (medicationsQuery.data?.medications ?? []).map((med) => ({
      medicationName: med.name,
      detectedAs: med.detectedAs as any,
      startDate: '',
      status: 'active' as const,
    }))

    // Compute test result preview to detect unexpected positives
    const { data: preview } = useComputeTestResultPreviewQuery(
      client?.id,
      (labScreenData?.detectedSubstances ?? []) as SubstanceValue[],
      labScreenData?.testType ?? '11-panel-lab',
      labScreenData?.breathalyzerTaken ?? false,
      labScreenData?.breathalyzerResult ?? null,
    )

    const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
    const requiresDecision = hasUnexpectedPositives && !preview?.autoAccept

    // Clear error if no decision required
    useEffect(() => {
      if (requiresDecision === true) {
        form.setFieldValue('labScreenData.confirmationDecisionRequired', true)
        form.validate('submit')
      }
      if (requiresDecision === false) {
        form.setFieldValue('labScreenData.confirmationDecisionRequired', false)
        form.validate('submit')
      }
    }, [requiresDecision])

    // Get confirmation decision from form state
    const confirmationDecisionValue = labScreenData?.confirmationDecision
    const confirmationSubstancesValue = labScreenData?.confirmationSubstances ?? []

    // Handler for confirmation decision changes
    const handleConfirmationDecisionChange = (value: 'accept' | 'request-confirmation' | 'pending-decision') => {
      form.setFieldValue('labScreenData.confirmationDecision', value)

      // Auto-populate confirmation substances when requesting confirmation
      if (value === 'request-confirmation' && preview?.unexpectedPositives) {
        const currentSubstances = confirmationSubstancesValue || []
        if (currentSubstances.length === 0) {
          form.setFieldValue('labScreenData.confirmationSubstances', preview.unexpectedPositives)
        }
      }
    }

    // Initialize form with extracted data
    // useEffect(() => {
    //   if (extractData) {
    //     if (extractData.collectionDate) {
    //       form.setFieldValue('labScreenData.collectionDate', extractData.collectionDate)
    //     }
    //     if (extractData.detectedSubstances) {
    //       form.setFieldValue('labScreenData.detectedSubstances', extractData.detectedSubstances)
    //     }
    //     if (extractData.isDilute !== undefined) {
    //       form.setFieldValue('labScreenData.isDilute', extractData.isDilute)
    //     }
    //     if (extractData.testType) {
    //       form.setFieldValue('labScreenData.testType', extractData.testType)
    //     }
    //   }
    //   // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [extractData])

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Verify Lab Screening Data"
          description="Review and adjust the extracted lab results before updating the test record"
        />

        {/* Client Info & Medications */}
        {client && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <ClientInfoCard client={client} />
            {clientMedications.length > 0 && <MedicationDisplayField medications={clientMedications} />}
          </div>
        )}

        {/* Matched Test Info */}
        {matchCollection && matchCollection.clientName && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Matched Test</p>
                <p className="font-medium">{matchCollection.clientName}</p>
                <p className="text-muted-foreground text-sm">{matchCollection.testType}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Data Form */}
        <Card className="@container shadow-md">
          <CardContent className="grid gap-6 pt-6">
            {/* Test Type */}
            <FieldGroup className="grid @lg:grid-cols-2">
              <form.Field name="labScreenData.testType">
                {(field) => (
                  <Field className="@lg:col-span-1">
                    <FieldLabel>Test Type</FieldLabel>
                    <Input value={field.state.value} disabled readOnly />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>

            {/* Collection Date/Time */}
            <FieldGroup className="grid @lg:grid-cols-2">
              <form.Field name="labScreenData.collectionDate">
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
              name="labScreenData.detectedSubstances"
              listeners={{
                onChange: () => {
                  // Reset confirmation decision when detected substances change
                  if (confirmationDecisionValue) {
                    form.setFieldValue('labScreenData.confirmationDecision', undefined)
                    form.setFieldValue('labScreenData.confirmationSubstances', [])
                  }
                },
              }}
            >
              {(field) => <field.SubstanceChecklistField />}
            </form.AppField>

            {/* Dilute Sample */}
            <Field orientation="horizontal">
              <form.Field name="labScreenData.isDilute">
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
                <form.Field name="labScreenData.breathalyzerTaken">
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

              {labScreenData?.breathalyzerTaken && (
                <form.Field name="labScreenData.breathalyzerResult">
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
            <form.Field name="labScreenData.confirmationDecision">
              {(field) => (
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
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>

            {/* Substance selection when request-confirmation is chosen */}
            {confirmationDecisionValue === 'request-confirmation' && (
              <form.Field name="labScreenData.confirmationSubstances">
                {(field) => (
                  <div className="mt-5">
                    <ConfirmationSubstanceSelector
                      unexpectedPositives={preview?.unexpectedPositives ?? []}
                      selectedSubstances={confirmationSubstancesValue ?? []}
                      onSelectionChange={(substances) =>
                        form.setFieldValue('labScreenData.confirmationSubstances', substances)
                      }
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

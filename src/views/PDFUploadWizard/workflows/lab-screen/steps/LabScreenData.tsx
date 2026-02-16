'use client'

import { useCallback, useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import InputDateTimePicker from '@/components/input-datetime-picker'
import { HeadshotCaptureCard, MedicationDisplayField, FieldGroupHeader } from '../../components'
import { getLabScreenFormOpts } from '../shared-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import {
  invalidateWizardClientDerivedData,
  useComputeTestResultPreviewQuery,
  useGetClientFromTestQuery,
  useGetDrugTestWithMedicationsQuery,
} from '../../../queries'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { cn } from '@/utilities/cn'
import { AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'

export const LabScreenDataStep = withForm({
  ...getLabScreenFormOpts('labScreenData'),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const formValues = useStore(form.store, (state) => state.values)
    const matchCollection = formValues.matchCollection
    const labScreenData = formValues.labScreenData

    // Fetch client from matched test
    const { data: client } = useGetClientFromTestQuery(matchCollection?.testId)

    // Fetch matched test with medications snapshot
    const { data: matchedTest } = useGetDrugTestWithMedicationsQuery(matchCollection?.testId)

    // Use medications from matched test (snapshot at collection time)
    // These are the only relevant medications - those active at the time of collection
    const clientMedications: MedicationSnapshot[] =
      matchedTest?.medicationsArrayAtTestTime?.map((med) => ({
        medicationName: med.medicationName,
        detectedAs: med.detectedAs,
      })) ?? []

    // Compute test result preview to detect unexpected positives
    const { data: preview } = useComputeTestResultPreviewQuery(
      client?.id,
      (labScreenData?.detectedSubstances ?? []) as SubstanceValue[],
      labScreenData?.testType ?? '11-panel-lab',
    )

    const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
    const requiresDecision = hasUnexpectedPositives && !preview?.autoAccept
    const matchedCollectionDate = matchCollection?.collectionDate ? new Date(matchCollection.collectionDate) : null
    const matchedCollectionDateLabel =
      matchedCollectionDate && !Number.isNaN(matchedCollectionDate.getTime())
        ? format(matchedCollectionDate, 'PPp')
        : 'Unknown'

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
    }, [requiresDecision, form])

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

    const handleHeadshotLinked = useCallback(
      (url: string, docId: string) => {
        form.setFieldValue('matchCollection.headshot', url)

        if (!matchCollection?.testId) return

        queryClient.setQueryData(
          ['client-from-test', matchCollection.testId],
          (currentClient: typeof client | null | undefined) => {
            if (!currentClient) return currentClient
            return {
              ...currentClient,
              headshot: url,
              headshotId: docId,
            }
          },
        )

        invalidateWizardClientDerivedData(queryClient, {
          clientId: client?.id,
          testId: matchCollection.testId,
        })
      },
      [client, form, matchCollection?.testId, queryClient],
    )

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Verify Lab Screening Data"
          description="Review and adjust the extracted lab results before updating the test record"
        />

        {/* Client Info & Medications */}
        {client && <HeadshotCaptureCard client={client} onHeadshotLinked={handleHeadshotLinked} />}

        {clientMedications.length > 0 && (
          <MedicationDisplayField medicationSnapshot={clientMedications} title="Medications at Collection Time" />
        )}

        {/* Matched Test Context */}
        {matchCollection?.testId && (
          <Card className="border-info/30 bg-info/5 transition-all">
            <CardContent className="grid gap-x-8 gap-y-3 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                  Collection Date
                </p>
                <p className="text-base leading-tight font-medium">{matchedCollectionDateLabel}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">Test Type</p>
                <p className="text-base leading-tight font-medium">{matchCollection.testType}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                  Record Status
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                    Confirmed Match
                  </Badge>
                  <Badge variant="outline">{matchCollection.screeningStatus}</Badge>
                </div>
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
              {(field) => <field.SubstanceChecklistField testType={labScreenData?.testType ?? '11-panel-lab'} />}
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

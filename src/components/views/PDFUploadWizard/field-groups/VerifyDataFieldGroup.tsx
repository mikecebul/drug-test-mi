'use client'

import React, { useEffect, useRef } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import InputDateTimePicker from '@/components/input-datetime-picker'
import MedicationDisplayField from '@/blocks/Form/field-components/medication-display-field'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import {
  useGetClientMedicationsQuery,
  useComputeTestResultPreviewQuery,
  useGetClientFromTestQuery,
} from '../queries'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Phone, User } from 'lucide-react'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { cn } from '@/utilities/cn'

// Export the schema for reuse in step validation
export const verifyDataFieldSchema = z.object({
  testType: z.enum(['15-panel-instant', '11-panel-lab', '17-panel-sos-lab', 'etg-lab']),
  collectionDate: z.string().min(1, 'Collection date is required'),
  detectedSubstances: z.array(z.string()),
  isDilute: z.boolean(),
  breathalyzerTaken: z.boolean().default(false),
  breathalyzerResult: z.number().nullable().optional(),
  clientData: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      middleInitial: z.string().nullable().optional(),
      email: z.string(),
      dob: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .nullable(),
  confirmationDecision: z
    .enum(['accept', 'request-confirmation', 'pending-decision'])
    .nullable()
    .optional(),
  confirmationSubstances: z.array(z.string()).optional(),
}).refine(
  (data) => {
    // If breathalyzer is checked, result must be provided
    if (data.breathalyzerTaken && (data.breathalyzerResult === null || data.breathalyzerResult === undefined)) {
      return false
    }
    return true
  },
  {
    message: 'Breathalyzer result is required when breathalyzer is taken',
    path: ['breathalyzerResult'],
  }
)

const defaultValues: PdfUploadFormType['verifyData'] = {
  testType: '15-panel-instant',
  collectionDate: '',
  detectedSubstances: [],
  isDilute: false,
  breathalyzerTaken: false,
  breathalyzerResult: null,
  clientData: null,
  confirmationDecision: null,
  confirmationSubstances: [],
}

export const VerifyDataFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Test Data',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    // Track initial mount to skip first effect run
    const isInitialMount = useRef(true)

    // Get form values
    const formValues = useStore(group.form.store, (state) => state.values)
    const extractData = (formValues as any).extractData
    const verifyData = (formValues as any).verifyData
    const verifyTest = (formValues as any).verifyTest

    // For lab workflows, fetch client data from the matched test
    const clientFromTestQuery = useGetClientFromTestQuery(verifyTest?.testId)

    // Client can come from:
    // 1. clientData (instant test workflow)
    // 2. verifyData.clientData (already set)
    // 3. clientFromTestQuery.data (lab screen workflow - fetched from matched test)
    const client =
      (formValues as any).clientData || verifyData?.clientData || clientFromTestQuery.data

    // Fetch medications using TanStack Query
    const medicationsQuery = useGetClientMedicationsQuery(client?.id)
    const medications = medicationsQuery.data?.medications ?? []

    // Initialize form with extracted data
    useEffect(() => {
      if (extractData?.testType) {
        group.setFieldValue('testType', extractData.testType)
      }
      if (extractData?.collectionDate) {
        group.setFieldValue('collectionDate', extractData.collectionDate.toISOString())
      }
      if (extractData?.detectedSubstances) {
        group.setFieldValue('detectedSubstances', extractData.detectedSubstances)
      }
      if (extractData?.isDilute !== undefined) {
        group.setFieldValue('isDilute', extractData.isDilute)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extractData])

    // Store client in verifyData for later access (lab workflows)
    useEffect(() => {
      if (client && !verifyData?.clientData) {
        group.setFieldValue('clientData', client)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client])

    const collectionDateValue = useStore(group.store, (state) => state.values.collectionDate)
    const collectionDateTime = collectionDateValue ? new Date(collectionDateValue) : undefined
    const testTypeValue = useStore(group.store, (state) => state.values.testType)
    const detectedSubstancesValue = useStore(
      group.store,
      (state) => state.values.detectedSubstances,
    )
    const confirmationDecisionValue = useStore(
      group.store,
      (state) => state.values.confirmationDecision,
    )
    const confirmationSubstancesValue = useStore(
      group.store,
      (state) => state.values.confirmationSubstances,
    )
    const breathalyzerTaken = useStore(group.store, (state) => state.values.breathalyzerTaken)

    // Compute test result preview to detect unexpected positives
    const previewQuery = useComputeTestResultPreviewQuery(
      client?.id,
      (detectedSubstancesValue ?? []) as SubstanceValue[],
    )
    const preview = previewQuery.data
    const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
    const requiresDecision = hasUnexpectedPositives && !preview?.autoAccept

    // Auto-populate confirmation substances when requesting confirmation
    useEffect(() => {
      if (confirmationDecisionValue === 'request-confirmation' && preview?.unexpectedPositives) {
        const currentSubstances = confirmationSubstancesValue || []
        if (currentSubstances.length === 0) {
          group.setFieldValue('confirmationSubstances', preview.unexpectedPositives)
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmationDecisionValue, preview?.unexpectedPositives])

    // Reset confirmation decision when detected substances change significantly
    // Skip this effect on initial mount to prevent race condition
    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false
        return
      }

      if (confirmationDecisionValue) {
        group.setFieldValue('confirmationDecision', null)
        group.setFieldValue('confirmationSubstances', [])
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(detectedSubstancesValue)])

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="bg-card border-border w-full rounded-xl border p-6 shadow-md">
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full">
                  <User className="text-primary h-4 w-4" />
                </div>
                <h3 className="text-foreground text-xl font-semibold">Client</h3>
              </div>
            </div>

            {/* Client Info */}
            <div className="space-y-1">
              <p className="text-foreground text-lg font-semibold">
                {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                {client?.lastName}
              </p>
              <p className="text-muted-foreground text-sm">{client?.email}</p>
              {client?.dob && (
                <p className="text-muted-foreground text-sm">
                  DOB: {new Date(client.dob).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {medications.length > 0 && <MedicationDisplayField medications={medications} />}
        </div>

        <Card className="shadow-md">
          <CardContent className="space-y-4 pt-6">
            <group.AppField name="testType">
              {(field) => (
                <field.SelectField
                  label="Test Type"
                  options={[
                    { value: '15-panel-instant', label: '15-Panel Instant' },
                    { value: '11-panel-lab', label: '11-Panel Lab' },
                    { value: '17-panel-sos-lab', label: '17-Panel SOS Lab' },
                    { value: 'etg-lab', label: 'EtG Lab' },
                  ]}
                  required
                />
              )}
            </group.AppField>

            <group.AppField name="collectionDate">
              {(field) => (
                <div className="max-w-sm space-y-2">
                  <InputDateTimePicker
                    id="collection-date"
                    label="Collection Date & Time"
                    value={collectionDateTime}
                    onChange={(date) => field.handleChange(date?.toISOString() || '')}
                    placeholder="Select date"
                    required
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-destructive text-sm">{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </group.AppField>

            <group.AppField name="isDilute">
              {(field) => <field.CheckboxField label="Dilute Sample" />}
            </group.AppField>

            {/* Breathalyzer Section */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/50">
              <h3 className="text-sm font-medium">Breathalyzer Test (Optional)</h3>

              <group.AppField name="breathalyzerTaken">
                {(field) => <field.CheckboxField label="Breathalyzer test was administered" />}
              </group.AppField>

              {breathalyzerTaken && (
                <group.Field name="breathalyzerResult">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="breathalyzerResult">
                        BAC Result <span className="text-destructive">*</span>
                      </Label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="1"
                        id="breathalyzerResult"
                        value={field.state.value ?? ''}
                        onChange={(e) => field.handleChange(e.target.value ? parseFloat(e.target.value) : null)}
                        onBlur={field.handleBlur}
                        placeholder="0.000"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter result with 3 decimal places. Threshold: 0.000 (any detectable alcohol = positive)
                      </p>
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-destructive text-sm">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </group.Field>
              )}
            </div>

            <group.AppField name="detectedSubstances">
              {(field) => <field.SubstanceChecklistField testType={testTypeValue} />}
            </group.AppField>
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
                <h2 className="text-foreground text-xl font-semibold">
                  Confirmation Decision Required
                </h2>
              </div>
              <p className="text-warning-foreground mt-2 text-sm">
                Unexpected positive substances detected.{' '}
                {testTypeValue !== '15-panel-instant'
                  ? 'Contact client to determine how to proceed.'
                  : 'Choose how to proceed.'}
              </p>
            </div>

            {/* Unexpected Positives */}
            <div className="mb-5">
              <p className="text-muted-foreground mb-2 text-sm font-medium">
                Unexpected Positives:
              </p>
              <div className="flex flex-wrap gap-2">
                {preview?.unexpectedPositives?.map((substance) => (
                  <Badge key={substance} variant="destructive">
                    {formatSubstance(substance)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Contact Client - Uses card background to stand out from warning-muted parent */}
            {testTypeValue !== '15-panel-instant' && client?.phone && (
              <div className="border-border bg-card mb-5 rounded-lg border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Contact Client</p>
                    <p className="text-foreground text-lg font-semibold tabular-nums">
                      {client.phone}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
                    <a href={`tel:${client.phone}`}>
                      <Phone className="h-4 w-4" />
                      Call
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* Client Decision */}
            <div>
              <p className="text-muted-foreground mb-3 text-sm font-medium">
                {testTypeValue !== '15-panel-instant'
                  ? 'Client Decision:'
                  : 'How would you like to proceed?'}
              </p>
              <RadioGroup
                value={confirmationDecisionValue || ''}
                onValueChange={(value) =>
                  group.setFieldValue(
                    'confirmationDecision',
                    value as 'accept' | 'request-confirmation' | 'pending-decision',
                  )
                }
                className="space-y-2.5"
              >
                <Label
                  htmlFor="accept"
                  className={cn(
                    'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                    confirmationDecisionValue === 'accept' &&
                      'border-foreground/50 ring-foreground/20 ring-2',
                  )}
                >
                  <RadioGroupItem value="accept" id="accept" className="mt-0.5" />
                  <div className="flex-1">
                    <span className="text-foreground font-medium">Accept Results</span>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {testTypeValue === '15-panel-instant'
                        ? 'Accept the screening results as final. Sample will be disposed.'
                        : 'Client accepts screening results as final. No confirmation testing requested.'}
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
                  <RadioGroupItem
                    value="request-confirmation"
                    id="request-confirmation"
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-foreground font-medium">
                      Request Confirmation Testing
                    </span>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {testTypeValue === '15-panel-instant'
                        ? 'Send sample to lab for LC-MS/MS confirmation testing on selected substances.'
                        : 'Client requests LC-MS/MS confirmation testing on selected substances.'}
                    </p>
                  </div>
                </Label>

                {/* Show "Pending Decision" option for all test types */}
                <Label
                  htmlFor="pending-decision"
                  className={cn(
                    'border-border bg-card hover:border-muted-foreground/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm',
                    confirmationDecisionValue === 'pending-decision' &&
                      'border-foreground/50 ring-foreground/20 ring-2',
                  )}
                >
                  <RadioGroupItem
                    value="pending-decision"
                    id="pending-decision"
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-foreground font-medium">Pending Decision</span>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      Decision not yet made. Sample will be held for 30 days. Instant tests:
                      $30/substance, Lab tests: $45/substance.
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
                    group.setFieldValue('confirmationSubstances', substances)
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

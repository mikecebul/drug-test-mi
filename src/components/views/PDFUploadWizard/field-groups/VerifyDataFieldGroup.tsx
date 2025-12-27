'use client'

import React, { useEffect } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import InputDateTimePicker from '@/components/input-datetime-picker'
import MedicationDisplayField from '@/blocks/Form/field-components/medications/medication-display-field'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import {
  useGetClientMedicationsQuery,
  useComputeTestResultPreviewQuery,
  useGetClientFromTestQuery,
  useExtractPdfQuery,
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
import { Input } from '@/components/ui/input'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { SectionHeader } from '../components/SectionHeader'
import { wizardContainerStyles } from '../styles'
import { WizardType } from '../types'
import { TEST_TYPES } from '../utils/testMatching'

// Export the schema for reuse in step validation
export const verifyDataFieldSchema = z
  .object({
    testType: z.enum(TEST_TYPES),
    collectionDate: z.string().min(1, 'Collection date is required'),
    detectedSubstances: z.array(z.string()),
    isDilute: z.boolean(),
    breathalyzerTaken: z.boolean().default(false),
    breathalyzerResult: z.number().nullable().optional(),
    confirmationDecision: z.enum(['accept', 'request-confirmation', 'pending-decision']).nullable().optional(),
    confirmationSubstances: z.array(z.string()).optional(),
  })
  .refine(
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
    },
  )

const defaultValues: PdfUploadFormType['verifyData'] = {
  testType: '15-panel-instant',
  collectionDate: '',
  detectedSubstances: [],
  isDilute: false,
  breathalyzerTaken: false,
  breathalyzerResult: null,
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
    // Get form values
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const verifyTest = formValues?.verifyTest

    // Get uploaded file to access extracted data from query cache
    const uploadedFile = formValues?.uploadData?.file as File | null
    const uploadTestType = formValues?.uploadData?.wizardType as WizardType

    // Get extracted data from query cache (cached from ExtractFieldGroup)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, uploadTestType)

    // For lab workflows, fetch client data from the matched test
    const clientFromTestQuery = useGetClientFromTestQuery(verifyTest?.testId)

    // Client can come from:
    // 1. clientData (instant test workflow - selected in VerifyClientFieldGroup)
    // 2. clientFromTestQuery.data (lab screen workflow - fetched from matched test)
    const client = formValues?.clientData || clientFromTestQuery.data

    // Get headshot from client
    const clientHeadshot = client?.headshot || null

    // Fetch medications using TanStack Query
    const medicationsQuery = useGetClientMedicationsQuery(client?.id)
    const medications = medicationsQuery.data?.medications ?? []

    // Initialize form with extracted data
    useEffect(() => {
      if (extractData?.testType) {
        group.setFieldValue('testType', extractData.testType)
      }
      if (extractData?.collectionDate) {
        // extractData.collectionDate is already an ISO string
        group.setFieldValue('collectionDate', extractData.collectionDate)
      }
      if (extractData?.detectedSubstances) {
        group.setFieldValue('detectedSubstances', extractData.detectedSubstances)
      }
      if (extractData?.isDilute !== undefined) {
        group.setFieldValue('isDilute', extractData.isDilute)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extractData])

    const collectionDateValue = useStore(group.store, (state) => state.values.collectionDate)
    const collectionDateTime = collectionDateValue ? new Date(collectionDateValue) : undefined
    const testTypeValue = useStore(group.store, (state) => state.values.testType)
    const detectedSubstancesValue = useStore(group.store, (state) => state.values.detectedSubstances)
    const confirmationDecisionValue = useStore(group.store, (state) => state.values.confirmationDecision)
    const confirmationSubstancesValue = useStore(group.store, (state) => state.values.confirmationSubstances)
    const breathalyzerTaken = useStore(group.store, (state) => state.values.breathalyzerTaken)

    // Compute test result preview to detect unexpected positives
    const previewQuery = useComputeTestResultPreviewQuery(
      client?.id,
      (detectedSubstancesValue ?? []) as SubstanceValue[],
      testTypeValue,
    )
    const preview = previewQuery.data
    const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
    const requiresDecision = hasUnexpectedPositives && !preview?.autoAccept

    // Handler for confirmation decision changes
    const handleConfirmationDecisionChange = (value: 'accept' | 'request-confirmation' | 'pending-decision') => {
      group.setFieldValue('confirmationDecision', value)

      // Auto-populate confirmation substances when requesting confirmation
      if (value === 'request-confirmation' && preview?.unexpectedPositives) {
        const currentSubstances = confirmationSubstancesValue || []
        if (currentSubstances.length === 0) {
          group.setFieldValue('confirmationSubstances', preview.unexpectedPositives)
        }
      }
    }

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title={title} description={description} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={cn('bg-card border-border w-full rounded-xl border shadow-md', wizardContainerStyles.card)}>
            {/* Client Info */}
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={clientHeadshot ?? undefined} alt={`${client?.firstName} ${client?.lastName}`} />
                <AvatarFallback className="text-lg">
                  {client?.firstName?.charAt(0)}
                  {client?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="text-foreground text-lg font-semibold">
                  {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                  {client?.lastName}
                </p>
                <p className="text-muted-foreground text-sm">{client?.email}</p>
                {client?.dob && (
                  <p className="text-muted-foreground text-sm">DOB: {new Date(client.dob).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>

          {medications.length > 0 && <MedicationDisplayField medications={medications} />}
        </div>

        <Card className={cn('shadow-md')}>
          <CardContent className={cn(wizardContainerStyles.fields, 'pt-6 text-base md:text-lg')}>
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

            <group.AppField name="isDilute">{(field) => <field.CheckboxField label="Dilute Sample" />}</group.AppField>

            {/* Breathalyzer Section */}
            <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-medium">Breathalyzer Test (Optional)</h3>

              <group.AppField name="breathalyzerTaken">
                {(field) => <field.CheckboxField label="Breathalyzer test was administered" />}
              </group.AppField>

              {breathalyzerTaken && (
                <group.Field
                  name="breathalyzerResult"
                  validators={{
                    onChange: ({ value }) =>
                      value === null || value === undefined
                        ? 'Breathalyzer result is required'
                        : value < 0
                          ? 'Breathalyzer result can&post be a negative number'
                          : undefined,
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="breathalyzerResult">
                        BAC Result <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        max="1"
                        id="breathalyzerResult"
                        value={field.state.value ?? ''}
                        onChange={(e) => field.handleChange(e.target.value ? parseFloat(e.target.value) : null)}
                        onBlur={field.handleBlur}
                        placeholder="0.000"
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <p className="text-muted-foreground text-xs">
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

            <group.AppField
              name="detectedSubstances"
              listeners={{
                onChange: () => {
                  // Reset confirmation decision when detected substances change
                  // This ensures the user makes a fresh decision when test results change
                  if (confirmationDecisionValue) {
                    group.setFieldValue('confirmationDecision', null)
                    group.setFieldValue('confirmationSubstances', [])
                  }
                },
              }}
            >
              {(field) => <field.SubstanceChecklistField testType={testTypeValue} />}
            </group.AppField>
          </CardContent>
        </Card>

        {/* Confirmation Decision Section - only show when there are unexpected positives */}
        {requiresDecision && (
          <div
            className={cn(
              'border-warning/50 bg-warning-muted/50 w-full rounded-xl border shadow-md',
              wizardContainerStyles.card,
            )}
          >
            {/* Header */}
            <div className="mb-6">
              <SectionHeader
                icon={<AlertTriangle className="text-warning h-5 w-5" />}
                title="Confirmation Decision Required"
              />
              <p className="text-warning-foreground mt-2 text-sm">
                Unexpected positive substances detected.{' '}
                {testTypeValue !== '15-panel-instant'
                  ? 'Contact client to determine how to proceed.'
                  : 'Choose how to proceed.'}
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

            {/* Contact Client - Uses card background to stand out from warning-muted parent */}
            {testTypeValue !== '15-panel-instant' && client?.phone && (
              <div className="border-border bg-card mb-5 rounded-lg border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Contact Client</p>
                    <p className="text-foreground text-lg font-semibold tabular-nums">{client.phone}</p>
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
                {testTypeValue !== '15-panel-instant' ? 'Client Decision:' : 'How would you like to proceed?'}
              </p>
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
                  <RadioGroupItem value="request-confirmation" id="request-confirmation" className="mt-0.5" />
                  <div className="flex-1">
                    <span className="text-foreground font-medium">Request Confirmation Testing</span>
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
                  <RadioGroupItem value="pending-decision" id="pending-decision" className="mt-0.5" />
                  <div className="flex-1">
                    <span className="text-foreground font-medium">Pending Decision</span>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      Decision not yet made. Sample will be held for 30 days. Instant tests: $30/substance, Lab tests:
                      $45/substance.
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
                  onSelectionChange={(substances) => group.setFieldValue('confirmationSubstances', substances)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
})

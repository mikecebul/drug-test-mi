'use client'

import React, { useEffect } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import InputDateTimePicker from '@/components/input-datetime-picker'
import MedicationDisplayField from '@/blocks/Form/field-components/medication-display-field'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { useGetClientMedicationsQuery, useComputeTestResultPreviewQuery, useGetClientFromTestQuery } from '../queries'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'

// Export the schema for reuse in step validation
export const verifyDataFieldSchema = z.object({
  testType: z.enum(['15-panel-instant', '11-panel-lab', '17-panel-sos-lab', 'etg-lab']),
  collectionDate: z.string().min(1, 'Collection date is required'),
  detectedSubstances: z.array(z.string()),
  isDilute: z.boolean(),
  clientData: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleInitial: z.string().nullable().optional(),
    email: z.string(),
    dob: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }).nullable(),
  confirmationDecision: z.enum(['accept', 'request-confirmation', 'not-available']).nullable().optional(),
  confirmationSubstances: z.array(z.string()).optional(),
})

const defaultValues: PdfUploadFormType['verifyData'] = {
  testType: '15-panel-instant',
  collectionDate: '',
  detectedSubstances: [],
  isDilute: false,
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
    const client = (formValues as any).clientData || verifyData?.clientData || clientFromTestQuery.data

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
    const detectedSubstancesValue = useStore(group.store, (state) => state.values.detectedSubstances)
    const confirmationDecisionValue = useStore(group.store, (state) => state.values.confirmationDecision)
    const confirmationSubstancesValue = useStore(group.store, (state) => state.values.confirmationSubstances)

    // Compute test result preview to detect unexpected positives
    const previewQuery = useComputeTestResultPreviewQuery(
      client?.id,
      (detectedSubstancesValue ?? []) as SubstanceValue[]
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
    useEffect(() => {
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
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wide text-blue-900 dark:text-blue-100">
                Client
              </CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                {client?.lastName}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{client?.email}</p>
              {client?.dob && (
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  DOB: {new Date(client.dob).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          {medications.length > 0 && <MedicationDisplayField medications={medications} />}
        </div>

        <Card>
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
                <div className="space-y-2 max-w-sm">
                  <InputDateTimePicker
                    id="collection-date"
                    label="Collection Date & Time"
                    value={collectionDateTime}
                    onChange={(date) => field.handleChange(date?.toISOString() || '')}
                    placeholder="Select date"
                    required
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </group.AppField>

            <group.AppField name="isDilute">
              {(field) => <field.CheckboxField label="Dilute Sample" />}
            </group.AppField>

            <group.AppField name="detectedSubstances">
              {(field) => <field.SubstanceChecklistField testType={testTypeValue} />}
            </group.AppField>
          </CardContent>
        </Card>

        {/* Confirmation Decision Section - only show when there are unexpected positives */}
        {requiresDecision && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-5 w-5" />
                Confirmation Decision Required
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                Unexpected positive substances detected. {testTypeValue !== '15-panel-instant' ? 'Contact client to determine how to proceed.' : 'Choose how to proceed.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display unexpected positives */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
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

              {/* For lab screens, show client contact info with call button */}
              {testTypeValue !== '15-panel-instant' && client?.phone && (
                <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Contact Client
                        </p>
                        <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                          {client.phone}
                        </p>
                      </div>
                      <a
                        href={`tel:${client.phone}`}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Call
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Radio buttons for decision */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {testTypeValue !== '15-panel-instant' ? 'Client Decision:' : 'How would you like to proceed?'}
                </Label>
                <RadioGroup
                  value={confirmationDecisionValue || ''}
                  onValueChange={(value) => group.setFieldValue('confirmationDecision', value as 'accept' | 'request-confirmation' | 'not-available')}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 rounded-md border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-amber-950/50">
                    <RadioGroupItem value="accept" id="accept" className="mt-1" />
                    <div>
                      <Label htmlFor="accept" className="font-medium cursor-pointer">
                        Accept Results
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {testTypeValue === '15-panel-instant'
                          ? 'Accept the screening results as final. Sample will be disposed.'
                          : 'Client accepts screening results as final. No confirmation testing requested.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 rounded-md border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-amber-950/50">
                    <RadioGroupItem value="request-confirmation" id="request-confirmation" className="mt-1" />
                    <div>
                      <Label htmlFor="request-confirmation" className="font-medium cursor-pointer">
                        Request Confirmation Testing
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {testTypeValue === '15-panel-instant'
                          ? 'Send sample to lab for LC-MS/MS confirmation testing on selected substances.'
                          : 'Client requests LC-MS/MS confirmation testing on selected substances.'}
                      </p>
                    </div>
                  </div>
                  {/* Only show "Client Not Available" option for lab screens */}
                  {testTypeValue !== '15-panel-instant' && (
                    <div className="flex items-start space-x-3 rounded-md border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-amber-950/50">
                      <RadioGroupItem value="not-available" id="not-available" className="mt-1" />
                      <div>
                        <Label htmlFor="not-available" className="font-medium cursor-pointer">
                          Client Not Available
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Unable to reach client. Sample will be held by lab for 30 days for confirmation decision.
                        </p>
                      </div>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {/* Substance selection when request-confirmation is chosen */}
              {confirmationDecisionValue === 'request-confirmation' && (
                <ConfirmationSubstanceSelector
                  unexpectedPositives={preview?.unexpectedPositives ?? []}
                  selectedSubstances={confirmationSubstancesValue ?? []}
                  onSelectionChange={(substances) => group.setFieldValue('confirmationSubstances', substances)}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  },
})

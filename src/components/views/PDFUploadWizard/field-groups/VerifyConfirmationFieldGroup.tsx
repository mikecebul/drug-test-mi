'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import MedicationDisplayField from '@/blocks/Form/field-components/medication-display-field'
import { getClientMedications, getClientFromTest } from '../actions'
import { z } from 'zod'
import { Trash2, Plus } from 'lucide-react'
import { getSubstanceOptions } from '@/fields/substanceOptions'

// Export the schema for reuse in step validation
export const verifyConfirmationFieldSchema = z.object({
  confirmationResults: z
    .array(
      z.object({
        substance: z.string(),
        result: z.enum(['confirmed-positive', 'confirmed-negative', 'inconclusive']),
      }),
    )
    .min(1, 'At least one confirmation result is required'),
  clientData: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      middleInitial: z.string().nullable().optional(),
      email: z.string(),
      dob: z.string().nullable().optional(),
    })
    .nullable(),
  detectedSubstances: z.array(z.string()),
  isDilute: z.boolean(),
})

type VerifyConfirmationData = z.infer<typeof verifyConfirmationFieldSchema>

const defaultValues: VerifyConfirmationData = {
  confirmationResults: [],
  clientData: null,
  detectedSubstances: [],
  isDilute: false,
}

export const VerifyConfirmationFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Confirmation Results',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    const [medications, setMedications] = useState<Array<{ name: string; detectedAs: string[] }>>(
      [],
    )
    const [client, setClient] = useState<any>(null)
    const [screeningResults, setScreeningResults] = useState<string[]>([])

    // Get form values
    const formValues = useStore(group.form.store, (state) => state.values)
    const extractData = (formValues as any).extractData
    const verifyTest = (formValues as any).verifyTest

    // Initialize form with extracted confirmation results
    useEffect(() => {
      if (extractData?.confirmationResults && extractData.confirmationResults.length > 0) {
        group.setFieldValue('confirmationResults', extractData.confirmationResults)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extractData?.confirmationResults])

    // Fetch client from selected test and get screening results
    useEffect(() => {
      async function fetchClientAndTest() {
        if (!verifyTest?.testId) {
          setClient(null)
          setScreeningResults([])
          group.setFieldValue('clientData', null)
          group.setFieldValue('detectedSubstances', [])
          group.setFieldValue('isDilute', false)
          return
        }

        try {
          const result = await getClientFromTest(verifyTest.testId)
          if (result.success && result.client) {
            setClient(result.client)
            // Store client in form so it's available in other steps
            group.setFieldValue('clientData', result.client)

            // Fetch the drug test to get screening results
            const testResponse = await fetch(`/api/drug-tests/${verifyTest.testId}`)
            if (testResponse.ok) {
              const testData = await testResponse.json()
              setScreeningResults(testData.detectedSubstances || [])
              // Store screening data in form so it's available in ConfirmConfirmationFieldGroup
              group.setFieldValue('detectedSubstances', testData.detectedSubstances || [])
              group.setFieldValue('isDilute', testData.isDilute || false)
            }
          } else {
            console.error('Failed to fetch client:', result.error)
            setClient(null)
            setScreeningResults([])
            group.setFieldValue('clientData', null)
            group.setFieldValue('detectedSubstances', [])
            group.setFieldValue('isDilute', false)
          }
        } catch (error) {
          console.error('Error fetching client and test:', error)
          setClient(null)
          setScreeningResults([])
          group.setFieldValue('clientData', null)
          group.setFieldValue('detectedSubstances', [])
          group.setFieldValue('isDilute', false)
        }
      }
      fetchClientAndTest()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verifyTest?.testId])

    // Fetch medications when client is loaded
    useEffect(() => {
      async function fetchMedications() {
        if (!client?.id) {
          setMedications([])
          return
        }

        const result = await getClientMedications(client.id)
        setMedications(result.medications)
      }
      fetchMedications()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client?.id])

    const confirmationResults = useStore(
      group.store,
      (state) => state.values.confirmationResults,
    ) as VerifyConfirmationData['confirmationResults']

    // Get substance options based on test type
    const testType = verifyTest?.testType || '11-panel-lab'
    const substanceOptions = getSubstanceOptions(testType)

    const handleResultChange = (
      index: number,
      field: keyof VerifyConfirmationData['confirmationResults'][number],
      value: any,
    ) => {
      const updated = [...confirmationResults]
      updated[index] = { ...updated[index], [field]: value }
      group.setFieldValue('confirmationResults', updated)
    }

    const handleRemoveResult = (index: number) => {
      const updated = confirmationResults.filter((_, i) => i !== index)
      group.setFieldValue('confirmationResults', updated)
    }

    const handleAddResult = () => {
      const updated = [
        ...confirmationResults,
        { substance: '', result: 'confirmed-negative' as const },
      ]
      group.setFieldValue('confirmationResults', updated)
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm tracking-wide text-blue-900 uppercase dark:text-blue-100">
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

        {/* Screening Results (Read-Only Context) */}
        {screeningResults.length > 0 && (
          <Card className="border-muted bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm tracking-wide uppercase">
                Original Screening Results (Reference)
              </CardTitle>
              <CardDescription className="text-xs">
                These are the initial screening results - not editable in this workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {screeningResults.map((substance) => (
                  <Badge key={substance} variant="outline">
                    {substance}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Results (Editable) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="pb-2">Confirmation Results (LC-MS/MS)</CardTitle>
                <CardDescription>
                  Verify and edit the confirmation test results extracted from the PDF
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddResult}>
                <Plus className="mr-2 h-4 w-4" />
                Add Result
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {confirmationResults.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No confirmation results yet. Click &ldquo;Add Result&rdquo; to add one.
              </p>
            ) : (
              confirmationResults.map((result, index) => (
                <Card key={index} className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveResult(index)}
                    className="text-destructive hover:text-destructive absolute right-2 top-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 pr-8 md:grid-cols-2">
                      {/* Substance */}
                      <div className="space-y-2">
                        <Label htmlFor={`substance-${index}`}>Substance</Label>
                        <Select
                          value={result.substance}
                          onValueChange={(value) => handleResultChange(index, 'substance', value)}
                        >
                          <SelectTrigger id={`substance-${index}`}>
                            <SelectValue placeholder="Select substance..." />
                          </SelectTrigger>
                          <SelectContent>
                            {substanceOptions.map((option: { value: string; label: string }) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Result */}
                      <div className="space-y-2">
                        <Label htmlFor={`result-${index}`}>Confirmation Result</Label>
                        <Select
                          value={result.result}
                          onValueChange={(value) => handleResultChange(index, 'result', value)}
                        >
                          <SelectTrigger id={`result-${index}`}>
                            <SelectValue placeholder="Select result..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="confirmed-negative">Confirmed Negative</SelectItem>
                            <SelectItem value="confirmed-positive">Confirmed Positive</SelectItem>
                            <SelectItem value="inconclusive">Inconclusive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Validation Error */}
        <group.Field name="confirmationResults">
          {(field) =>
            field.state.meta.errors.length > 0 && (
              <p className="text-destructive text-sm">{field.state.meta.errors[0]}</p>
            )
          }
        </group.Field>
      </div>
    )
  },
})

'use client'

import React, { useEffect } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { z } from 'zod'
import { Trash2, Plus, User } from 'lucide-react'
import { getSubstanceOptions } from '@/fields/substanceOptions'
import { useGetClientMedicationsQuery, useGetClientFromTestQuery, useGetDrugTestQuery, useExtractPdfQuery } from '../queries'

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
    // Get form values
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const verifyTest = formValues?.verifyTest

    // Get uploaded file to access extracted data from query cache
    const uploadedFile = formValues?.uploadData?.file as File | null
    const uploadTestType = formValues?.uploadData?.testType as
      | '15-panel-instant'
      | '11-panel-lab'
      | '17-panel-sos-lab'
      | 'etg-lab'
      | undefined

    // Get extracted data from query cache (cached from ExtractFieldGroup)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, uploadTestType)

    // Fetch client from selected test using TanStack Query
    const clientQuery = useGetClientFromTestQuery(verifyTest?.testId)
    const client = clientQuery.data ?? null

    // Fetch drug test details (screening results) using TanStack Query
    const drugTestQuery = useGetDrugTestQuery(verifyTest?.testId)
    const screeningResults = drugTestQuery.data?.detectedSubstances ?? []

    // Fetch medications using TanStack Query
    const medicationsQuery = useGetClientMedicationsQuery(client?.id)
    const medications = medicationsQuery.data?.medications ?? []

    // Initialize form with extracted confirmation results
    useEffect(() => {
      if (extractData?.confirmationResults && extractData.confirmationResults.length > 0) {
        group.setFieldValue('confirmationResults', extractData.confirmationResults)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extractData?.confirmationResults])

    // Store client data in form when it loads
    useEffect(() => {
      if (client) {
        group.setFieldValue('clientData', client)
      } else if (!verifyTest?.testId) {
        group.setFieldValue('clientData', null)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, verifyTest?.testId])

    // Store screening results in form when they load
    useEffect(() => {
      if (drugTestQuery.data) {
        group.setFieldValue('detectedSubstances', drugTestQuery.data.detectedSubstances || [])
        group.setFieldValue('isDilute', drugTestQuery.data.isDilute || false)
      } else if (!verifyTest?.testId) {
        group.setFieldValue('detectedSubstances', [])
        group.setFieldValue('isDilute', false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drugTestQuery.data, verifyTest?.testId])

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
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={client?.headshot ?? undefined} alt={`${client?.firstName} ${client?.lastName}`} />
                <AvatarFallback className="text-lg">
                  {client?.firstName?.charAt(0)}{client?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
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
          </div>

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

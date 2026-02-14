'use client'

import { useCallback, useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FieldError } from '@/components/ui/field'
import { HeadshotCaptureCard, MedicationDisplayField, FieldGroupHeader } from '../../components'
import { getLabConfirmationFormOpts } from '../shared-form'
import { Plus, Trash2 } from 'lucide-react'
import {
  invalidateWizardClientDerivedData,
  useGetClientFromTestQuery,
  useGetDrugTestWithMedicationsQuery,
  useGetDrugTestQuery,
  useExtractPdfQuery,
} from '../../../queries'
import { getSubstanceOptions } from '@/fields/substanceOptions'
import { cn } from '@/utilities/cn'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'
import { format } from 'date-fns'

export const LabConfirmationDataStep = withForm({
  ...getLabConfirmationFormOpts('labConfirmationData'),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const formValues = useStore(form.store, (state) => state.values)
    const { matchCollection, labConfirmationData, upload } = formValues

    // Fetch client from matched test
    const { data: client } = useGetClientFromTestQuery(matchCollection?.testId)

    // Fetch matched test to get original screening data
    const { data: matchedTest } = useGetDrugTestQuery(matchCollection?.testId)
    // Fetch matched test with medications snapshot for consistent meds rendering
    const { data: matchedTestWithMedications } = useGetDrugTestWithMedicationsQuery(matchCollection?.testId)

    // Get extracted data from query cache (if PDF has confirmation results)
    const { data: extractData } = useExtractPdfQuery(upload.file, 'enter-lab-confirmation')

    // Get medications snapshot from matched test
    const clientMedications: MedicationSnapshot[] =
      matchedTestWithMedications?.medicationsArrayAtTestTime?.map((med: any) => ({
        medicationName: med.medicationName,
        detectedAs: med.detectedAs,
      })) ?? []

    // Initialize form with screening data when test loads
    useEffect(() => {
      if (matchedTest) {
        form.setFieldValue('labConfirmationData.originalDetectedSubstances', matchedTest.detectedSubstances || [])
        form.setFieldValue('labConfirmationData.originalIsDilute', matchedTest.isDilute || false)
      }
    }, [matchedTest, form])

    // Auto-populate confirmation results from extracted PDF
    useEffect(() => {
      if (extractData?.confirmationResults && extractData.confirmationResults.length > 0) {
        form.setFieldValue('labConfirmationData.confirmationResults', extractData.confirmationResults)
      }
    }, [extractData, form])

    const confirmationResults = labConfirmationData?.confirmationResults || []
    const testType = matchCollection?.testType || '11-panel-lab'
    const substanceOptions = getSubstanceOptions(testType)

    const handleAddResult = () => {
      const updated = [
        ...confirmationResults,
        { substance: '', result: 'confirmed-negative' as const, notes: '' },
      ]
      form.setFieldValue('labConfirmationData.confirmationResults', updated)
    }

    const handleRemoveResult = (index: number) => {
      const updated = confirmationResults.filter((_, i) => i !== index)
      form.setFieldValue('labConfirmationData.confirmationResults', updated)
    }

    const handleResultChange = (index: number, field: string, value: any) => {
      const updated = [...confirmationResults]
      updated[index] = { ...updated[index], [field]: value }
      form.setFieldValue('labConfirmationData.confirmationResults', updated)
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
          title="Enter Confirmation Results"
          description="Enter LC-MS/MS confirmation test results"
        />

        {/* Client Info & Medications */}
        {client && (
          <HeadshotCaptureCard client={client} onHeadshotLinked={handleHeadshotLinked} />
        )}

        {clientMedications.length > 0 && (
          <MedicationDisplayField
            medicationSnapshot={clientMedications}
            title="Medications at Collection Time"
          />
        )}

        {/* Matched Test Context + Original Screening Results */}
        {matchCollection?.testId && (
          <Card className="border-info/30 bg-info/5 transition-all">
            <CardContent className="space-y-5 pt-0">
              <div className="grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                    Collection Date
                  </p>
                  <p className="text-base leading-tight font-medium">{format(new Date(matchCollection.collectionDate), 'PPp')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">Test Type</p>
                  <p className="text-base leading-tight font-medium">{matchCollection.testType}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">Record Status</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                    Confirmed Match
                  </Badge>
                  {matchCollection.screeningStatus && <Badge variant="outline">{matchCollection.screeningStatus}</Badge>}
                </div>
              </div>

              {(labConfirmationData?.originalDetectedSubstances?.length ?? 0) > 0 && (
                <div className="border-border/70 space-y-2.5 border-t pt-4">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                    Original Screening Results
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {labConfirmationData.originalDetectedSubstances.map((substance: string) => (
                      <Badge key={substance} variant="outline">
                        {substance}
                      </Badge>
                    ))}
                    {labConfirmationData.originalIsDilute && <Badge variant="secondary">Dilute Sample</Badge>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Original Screening Results (Read-Only) fallback */}
        {!matchCollection?.testId &&
          labConfirmationData?.originalDetectedSubstances &&
          labConfirmationData.originalDetectedSubstances.length > 0 && (
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
                  {labConfirmationData.originalDetectedSubstances.map((substance: string) => (
                    <Badge key={substance} variant="outline">
                      {substance}
                    </Badge>
                  ))}
                  {labConfirmationData.originalIsDilute && <Badge variant="secondary">Dilute Sample</Badge>}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Confirmation Results (Editable) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Confirmation Results (LC-MS/MS)</CardTitle>
                <CardDescription>Enter the confirmation test results from the lab</CardDescription>
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
              confirmationResults.map((result: any, index: number) => (
                <Card key={index} className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveResult(index)}
                    className="text-destructive hover:text-destructive absolute top-2 right-2"
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

                      {/* Notes (optional) */}
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`notes-${index}`}>Notes (optional)</Label>
                        <Textarea
                          id={`notes-${index}`}
                          value={result.notes || ''}
                          onChange={(e) => handleResultChange(index, 'notes', e.target.value)}
                          placeholder="Add any notes about this confirmation result..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Validation Error */}
        <form.Field name="labConfirmationData.confirmationResults">
          {(field) => <FieldError errors={field.state.meta.errors} />}
        </form.Field>
      </div>
    )
  },
})

'use client'

import React, { useMemo } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  User,
  FileText,
  XCircle,
  AlertTriangle,
  Bell,
  Loader2,
} from 'lucide-react'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { generateTestFilename } from '../utils/generateFilename'
import { useComputeTestResultPreviewQuery } from '../queries'
import type { SubstanceValue } from '@/fields/substanceOptions'

// Export the schema for reuse in step validation
export const confirmConfirmationFieldSchema = z.object({
  previewComputed: z.boolean(),
})

const defaultValues: PdfUploadFormType['confirmData'] = {
  previewComputed: false,
}

export const ConfirmConfirmationFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Confirm Confirmation Update',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    // Get all form data
    const formValues = useStore(group.form.store, (state) => state.values)
    const verifyConfirmation = (formValues as any).verifyConfirmation
    const verifyTest = (formValues as any).verifyTest
    const uploadData = (formValues as any).uploadData

    // Get client and confirmation results
    const client = verifyConfirmation?.clientData
    const confirmationResults = verifyConfirmation?.confirmationResults || []
    const originalDetectedSubstances = verifyConfirmation?.detectedSubstances || []

    // Calculate final detected substances (removing confirmed negatives)
    const adjustedSubstances = useMemo(() => {
      return originalDetectedSubstances.filter((substance: string) => {
        const confirmationResult = confirmationResults.find(
          (r: any) => r.substance.toLowerCase() === substance.toLowerCase(),
        )
        return !(confirmationResult && confirmationResult.result === 'confirmed-negative')
      })
    }, [originalDetectedSubstances, confirmationResults])

    // Fetch test result preview using TanStack Query
    const previewQuery = useComputeTestResultPreviewQuery(
      client?.id,
      adjustedSubstances as SubstanceValue[]
    )
    const preview = previewQuery.data ?? null
    const loadingPreview = previewQuery.isLoading

    // Generate new filename and keep original
    const originalFilename = uploadData?.file?.name || 'No file'
    const newFilename =
      generateTestFilename({
        client,
        collectionDate: verifyTest?.collectionDate,
        testType: verifyTest?.testType,
        isConfirmation: true,
      }) || originalFilename

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Card className="border-primary">
          <CardHeader className="bg-primary/5 dark:bg-primary/10">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary h-5 w-5" />
              Confirmation Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                Client
              </div>
              <div className="pl-6">
                <p className="text-lg font-semibold">
                  {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                  {client?.lastName}
                </p>
                <p className="text-muted-foreground text-sm">{client?.email}</p>
              </div>
            </div>

            {/* Confirmation Results */}
            {confirmationResults.length > 0 && (
              <div className="space-y-2 border-t pt-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  Confirmation Results (LC-MS/MS)
                </div>
                <div className="space-y-2 pl-6">
                  {confirmationResults.map((result: any, index: number) => {
                    const resultConfig = {
                      'confirmed-positive': {
                        variant: 'destructive' as const,
                        icon: XCircle,
                        label: 'Confirmed Positive',
                      },
                      'confirmed-negative': {
                        variant: 'default' as const,
                        icon: CheckCircle2,
                        label: 'Confirmed Negative',
                      },
                      inconclusive: {
                        variant: 'secondary' as const,
                        icon: AlertTriangle,
                        label: 'Inconclusive',
                      },
                    }

                    const config = resultConfig[result.result]
                    const ResultIcon = config.icon

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md border p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {result.substance}
                          </Badge>
                          <Badge variant={config.variant} className="gap-1 text-xs">
                            <ResultIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {loadingPreview ? (
              <div className="border-t pt-2">
                <div className="text-muted-foreground flex items-center gap-2 pl-6 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing final test result...
                </div>
              </div>
            ) : (
              preview && (
                <div className="space-y-2 border-t pt-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    Final Test Result
                  </div>
                  <div className="space-y-3 pl-6">
                    {preview.initialScreenResult === 'negative' && (
                      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription>
                          <p className="font-semibold text-green-900 dark:text-green-100">
                            All Negative (Pass)
                          </p>
                          <p className="mt-1 text-sm text-green-800 dark:text-green-200">
                            All confirmation tests came back negative.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}

                    {preview.initialScreenResult === 'expected-positive' && (
                      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription>
                          <p className="font-semibold text-green-900 dark:text-green-100">
                            Expected Positive (Pass)
                          </p>
                          <p className="mt-1 text-sm text-green-800 dark:text-green-200">
                            All confirmed substances match client&apos;s prescribed medications.
                          </p>
                          {preview.expectedPositives.length > 0 && (
                            <div className="mt-2">
                              <p className="mb-1 text-xs text-green-700 dark:text-green-300">
                                Expected substances:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {preview.expectedPositives.map((substance) => (
                                  <Badge
                                    key={substance}
                                    variant="outline"
                                    className="bg-green-100 text-xs dark:bg-green-900/30"
                                  >
                                    {substance}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {preview.initialScreenResult === 'unexpected-positive' && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-semibold">Unexpected Positive (Fail)</p>
                          <p className="mt-1 text-sm">
                            Confirmed substances that are NOT in client&apos;s prescribed
                            medications.
                          </p>
                          {preview.unexpectedPositives.length > 0 && (
                            <div className="mt-2">
                              <p className="mb-1 text-xs">Unexpected substances:</p>
                              <div className="flex flex-wrap gap-1">
                                {preview.unexpectedPositives.map((substance) => (
                                  <Badge key={substance} variant="destructive" className="text-xs">
                                    {substance}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {(preview.initialScreenResult === 'unexpected-negative-critical' ||
                      preview.initialScreenResult === 'unexpected-negative-warning' ||
                      preview.initialScreenResult === 'mixed-unexpected') && (
                      <Alert
                        variant={
                          preview.initialScreenResult === 'unexpected-negative-warning'
                            ? 'default'
                            : 'destructive'
                        }
                        className={
                          preview.initialScreenResult === 'unexpected-negative-warning'
                            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                            : ''
                        }
                      >
                        {preview.initialScreenResult === 'unexpected-negative-warning' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>
                          <p className="font-semibold">
                            {preview.initialScreenResult === 'unexpected-negative-critical' &&
                              'Unexpected Negative - Critical (Fail)'}
                            {preview.initialScreenResult === 'unexpected-negative-warning' &&
                              'Unexpected Negative - Warning (Pass with Note)'}
                            {preview.initialScreenResult === 'mixed-unexpected' &&
                              'Mixed Unexpected Results (Fail)'}
                          </p>
                          {preview.unexpectedNegatives.length > 0 && (
                            <div className="mt-2">
                              <p className="mb-1 text-xs">Missing expected:</p>
                              <div className="flex flex-wrap gap-1">
                                {preview.unexpectedNegatives.map((substance) => (
                                  <Badge key={substance} variant="outline" className="text-xs">
                                    {substance}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )
            )}

            <div className="space-y-1 border-t pt-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                File Names
              </div>
              <div className="pl-6 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Original:</p>
                  <p className="text-sm font-mono">{originalFilename}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Will be saved as:</p>
                  <p className="text-sm font-mono font-semibold text-primary">{newFilename}</p>
                </div>
                <p className="text-muted-foreground text-xs">
                  {uploadData?.file
                    ? `${(uploadData.file.size / 1024).toFixed(2)} KB`
                    : 'No file uploaded'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription>
            <p className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-100">
              After updating, the system will automatically:
            </p>
            <ul className="space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                Update the test with confirmation results
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                Recalculate the final test result classification
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                Send updated notification emails to appropriate recipients
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    )
  },
})

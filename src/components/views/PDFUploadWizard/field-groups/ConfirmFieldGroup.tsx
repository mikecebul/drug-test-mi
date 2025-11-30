'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  User,
  Calendar,
  FileText,
  XCircle,
  AlertTriangle,
  Bell,
  Loader2,
} from 'lucide-react'
import { computeTestResultPreview } from '../actions'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'

// Export the schema for reuse in step validation
export const confirmFieldSchema = z.object({
  previewComputed: z.boolean(),
})

const defaultValues: PdfUploadFormType['confirmData'] = {
  previewComputed: false,
}

export const ConfirmFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Confirm and Create',
    description: 'Review the final data before creating the drug test record',
  },

  render: function Render({ group, title, description }) {
    const [preview, setPreview] = useState<{
      initialScreenResult: string
      expectedPositives: string[]
      unexpectedPositives: string[]
      unexpectedNegatives: string[]
      autoAccept: boolean
    } | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(true)

    // Get all form data
    const formValues = useStore(group.form.store, (state) => state.values)
    const client = (formValues as any).clientData
    const verifyData = (formValues as any).verifyData
    const uploadData = (formValues as any).uploadData

    useEffect(() => {
      async function fetchPreview() {
        if (!client?.id || !verifyData?.detectedSubstances) {
          setLoadingPreview(false)
          return
        }

        try {
          const result = await computeTestResultPreview(client.id, verifyData.detectedSubstances)
          setPreview(result)
        } catch (err) {
          console.error('Failed to compute preview:', err)
        } finally {
          setLoadingPreview(false)
        }
      }
      fetchPreview()
    }, [client?.id, verifyData?.detectedSubstances])

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Card className="border-primary">
          <CardHeader className="bg-primary/5 dark:bg-primary/10">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Test Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Client
              </div>
              <div className="pl-6">
                <p className="text-lg font-semibold">
                  {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                  {client?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{client?.email}</p>
              </div>
            </div>

            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Test Type
              </div>
              <p className="pl-6 text-lg font-medium">{verifyData?.testType}</p>
            </div>

            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Collection Date
              </div>
              <p className="pl-6 text-lg font-medium">
                {verifyData?.collectionDate
                  ? new Date(verifyData.collectionDate).toLocaleString()
                  : 'Not set'}
              </p>
            </div>

            <div className="space-y-2 border-t pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                Detected Substances (Screening)
              </div>
              <div className="pl-6">
                {verifyData?.detectedSubstances?.length > 0 ? (
                  <div className="space-y-2">
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      {verifyData.detectedSubstances.length} Positive
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      {verifyData.detectedSubstances.map((substance: string) => (
                        <Badge key={substance} variant="outline" className="text-xs">
                          {substance}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    All Negative
                  </Badge>
                )}
              </div>
            </div>

            {(formValues as any).extractData?.hasConfirmation &&
              (formValues as any).extractData?.confirmationResults &&
              (formValues as any).extractData.confirmationResults.length > 0 && (
                <div className="space-y-2 border-t pt-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    Confirmation Results (LC-MS/MS)
                  </div>
                  <div className="pl-6 space-y-2">
                    {(formValues as any).extractData.confirmationResults.map(
                      (result: any, index: number) => {
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
                          'inconclusive': {
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
                            {result.notes && (
                              <span className="text-xs text-muted-foreground">{result.notes}</span>
                            )}
                          </div>
                        )
                      },
                    )}
                  </div>
                </div>
              )}

            {loadingPreview ? (
              <div className="border-t pt-2">
                <div className="flex items-center gap-2 pl-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing test result classification...
                </div>
              </div>
            ) : (
              preview && (
                <div className="space-y-2 border-t pt-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    Test Result Classification
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
                            No substances detected and no medications expected. This result will be
                            automatically accepted.
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
                            All detected substances match client&apos;s prescribed medications.
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
                                    className="text-xs bg-green-100 dark:bg-green-900/30"
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
                            Detected substances that are NOT in client&apos;s prescribed medications.
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
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                Dilute Sample
              </div>
              <div className="pl-6">
                {verifyData?.isDilute ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="outline">No</Badge>
                )}
              </div>
            </div>

            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                PDF Document
              </div>
              <div className="pl-6">
                <p className="font-medium">{uploadData?.file?.name || 'No file'}</p>
                <p className="text-sm text-muted-foreground">
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
              After creation, the system will automatically:
            </p>
            <ul className="space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                Compare detected substances with client&apos;s medications
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                Calculate the test result classification
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                Send notification emails to appropriate recipients
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    )
  },
})

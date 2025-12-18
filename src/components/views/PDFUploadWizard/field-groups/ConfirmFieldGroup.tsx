'use client'

import React from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  User,
  Calendar,
  FileText,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { generateTestFilename } from '../utils/generateFilename'
import {
  useComputeTestResultPreviewQuery,
  useExtractPdfQuery,
  useGetClientFromTestQuery,
} from '../queries'

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
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    // Get all form data
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const verifyData = formValues?.verifyData
    const verifyTest = formValues?.verifyTest
    const uploadData = formValues?.uploadData

    // Get uploaded file to access extracted data from query cache
    const uploadedFile = uploadData?.file as File | null
    const uploadTestType = uploadData?.testType as
      | '15-panel-instant'
      | '11-panel-lab'
      | '17-panel-sos-lab'
      | 'etg-lab'
      | undefined

    // Get extracted data from query cache (cached from ExtractFieldGroup)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, uploadTestType)

    // For lab workflows, fetch client data from the matched test
    const clientFromTestQuery = useGetClientFromTestQuery(verifyTest?.testId)

    // Client can come from:
    // 1. clientData (instant test workflow - selected in VerifyClientFieldGroup)
    // 2. clientFromTestQuery.data (lab workflow - fetched from matched test)
    const client = formValues?.clientData || clientFromTestQuery.data

    // Get headshot from client
    const clientHeadshot = client?.headshot || null

    // Get medications from form state (updated in VerifyMedicationsFieldGroup)
    const allMedications = formValues?.medicationsData?.medications ?? []
    const activeMedications = allMedications.filter((med: any) => med.status === 'active')

    // Generate new filename and keep original
    const originalFilename = uploadData?.file?.name || 'No file'
    const newFilename =
      generateTestFilename({
        client,
        collectionDate: verifyData?.collectionDate,
        testType: verifyData?.testType,
        isConfirmation: false,
      }) || originalFilename

    // Fetch test result preview using TanStack Query
    const previewQuery = useComputeTestResultPreviewQuery(
      client?.id,
      verifyData?.detectedSubstances ?? [],
      verifyData?.testType,
      verifyData?.breathalyzerTaken ?? false,
      verifyData?.breathalyzerResult ?? null,
      allMedications, // Pass all medications (computeTestResults filters to active)
    )
    const preview = previewQuery.data ?? null
    const loadingPreview = previewQuery.isLoading

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
              Test Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                Client
              </div>
              <div className="flex items-start gap-3 pl-6">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={clientHeadshot ?? undefined} alt={`${client?.firstName} ${client?.lastName}`} />
                  <AvatarFallback className="text-sm">
                    {client?.firstName?.charAt(0)}{client?.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-0.5">
                  <p className="text-lg font-semibold">
                    {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                    {client?.lastName}
                  </p>
                  <p className="text-muted-foreground text-sm">{client?.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 border-t pt-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Test Type
              </div>
              <p className="pl-6 text-lg font-medium">{verifyData?.testType}</p>
            </div>

            <div className="space-y-1 border-t pt-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
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
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
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

            {extractData?.hasConfirmation &&
              extractData?.confirmationResults &&
              extractData.confirmationResults.length > 0 && (
                <div className="space-y-2 border-t pt-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    Confirmation Results (LC-MS/MS)
                  </div>
                  <div className="space-y-2 pl-6">
                    {extractData.confirmationResults.map(
                      (result: any, index: number) => {
                        const resultConfig = {
                          'confirmed-positive': {
                            variant: 'destructive' as const,
                            icon: XCircle,
                            label: 'Confirmed Positive',
                            className: '',
                          },
                          'confirmed-negative': {
                            variant: 'outline' as const,
                            icon: CheckCircle2,
                            label: 'Confirmed Negative',
                            className:
                              'border-green-600 bg-green-100 text-green-900 dark:border-green-400 dark:bg-green-900/30 dark:text-green-100',
                          },
                          inconclusive: {
                            variant: 'secondary' as const,
                            icon: AlertTriangle,
                            label: 'Inconclusive',
                            className: '',
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
                              <Badge
                                variant={config.variant}
                                className={`gap-1 text-xs ${config.className}`}
                              >
                                <ResultIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                            </div>
                            {result.notes && (
                              <span className="text-muted-foreground text-xs">{result.notes}</span>
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
                <div className="text-muted-foreground flex items-center gap-2 pl-6 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing test result classification...
                </div>
              </div>
            ) : (
              preview && (
                <div className="space-y-2 border-t pt-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
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
                            Detected substances that are NOT in client&apos;s prescribed
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
                            ? 'border-warning/50 bg-warning-muted/50 dark:border-warning/50 dark:bg-warning-muted/50'
                            : ''
                        }
                      >
                        {preview.initialScreenResult === 'unexpected-negative-warning' ? (
                          <AlertTriangle className="h-4 w-4 text-warning dark:text-warning" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>
                          <p
                            className={
                              preview.initialScreenResult === 'unexpected-negative-warning'
                                ? 'text-warning-foreground font-semibold'
                                : 'font-semibold'
                            }
                          >
                            {preview.initialScreenResult === 'unexpected-negative-critical' &&
                              'Unexpected Negative - Critical (Fail)'}
                            {preview.initialScreenResult === 'unexpected-negative-warning' &&
                              'Unexpected Negative - Warning (Pass with Note)'}
                            {preview.initialScreenResult === 'mixed-unexpected' &&
                              'Mixed Unexpected Results (Fail)'}
                          </p>
                          {preview.initialScreenResult === 'mixed-unexpected' &&
                            preview.unexpectedPositives.length > 0 && (
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
                          {preview.unexpectedNegatives.length > 0 && (
                            <div className="mt-2">
                              <p
                                className={
                                  preview.initialScreenResult === 'unexpected-negative-warning'
                                    ? 'text-warning-foreground mb-1 text-xs'
                                    : 'mb-1 text-xs'
                                }
                              >
                                Missing expected:
                              </p>
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

            {verifyData?.breathalyzerTaken && verifyData?.breathalyzerResult !== null && (
              <div className="space-y-2 border-t pt-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  Breathalyzer Test
                </div>
                <div className="pl-6">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={verifyData.breathalyzerResult > 0.000 ? 'destructive' : 'default'}
                      className={verifyData.breathalyzerResult > 0.000 ? 'gap-1' : 'gap-1 bg-green-600'}
                    >
                      {verifyData.breathalyzerResult > 0.000 ? (
                        <>
                          <XCircle className="h-3 w-3" />
                          POSITIVE (FAIL)
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          NEGATIVE (PASS)
                        </>
                      )}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">BAC Level:</span>{' '}
                    <span className="font-mono font-semibold">{verifyData.breathalyzerResult.toFixed(3)}</span>
                  </p>
                  {verifyData.breathalyzerResult > 0.000 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Any detectable alcohol level constitutes a positive result.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1 border-t pt-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
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
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                PDF Document
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
      </div>
    )
  },
})

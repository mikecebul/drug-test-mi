'use client'

import React, { useMemo } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, User, FileText, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { generateTestFilename } from '../utils/generateFilename'
import { useComputeTestResultPreviewQuery, useGetClientFromTestQuery } from '../queries'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { wizardContainerStyles } from '../styles'
import { cn } from '@/utilities/cn'

// Export the schema for reuse in step validation
export const confirmConfirmationFieldSchema = z.object({
  previewComputed: z.boolean(),
})

const defaultValues: PdfUploadFormType['testSummary'] = {
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

    // Fetch client data from the matched test
    const clientFromTestQuery = useGetClientFromTestQuery(verifyTest?.testId)
    const client = clientFromTestQuery.data

    // Calculate final detected substances (removing confirmed negatives)
    const { adjustedSubstances, confirmationResults, originalDetectedSubstances } = useMemo(() => {
      const confirmationResults = verifyConfirmation?.confirmationResults || []
      const originalDetectedSubstances = verifyConfirmation?.detectedSubstances || []

      const adjustedSubstances = originalDetectedSubstances.filter((substance: string) => {
        const confirmationResult = confirmationResults.find(
          (r: any) => r.substance.toLowerCase() === substance.toLowerCase(),
        )
        return !(confirmationResult && confirmationResult.result === 'confirmed-negative')
      })

      return { adjustedSubstances, confirmationResults, originalDetectedSubstances }
    }, [verifyConfirmation])

    // Fetch test result preview using TanStack Query
    const previewQuery = useComputeTestResultPreviewQuery(
      client?.id,
      adjustedSubstances as SubstanceValue[],
      verifyTest?.testType,
    )
    const preview = previewQuery.data ?? null
    const loadingPreview = previewQuery.isLoading

    // Generate new filename and keep original
    const originalFilename = uploadData?.file?.name || 'No file'
    const newFilename =
      generateTestFilename({
        client: client || null,
        collectionDate: verifyTest?.collectionDate,
        testType: verifyTest?.testType,
        isConfirmation: true,
      }) || originalFilename

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title={title} description={description} />
        <div className={cn(wizardContainerStyles.fields, 'text-base md:text-lg')}>
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
                <div className="flex items-start gap-3 pl-6">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage
                      src={client?.headshot ?? undefined}
                      alt={`${client?.firstName} ${client?.lastName}`}
                    />
                    <AvatarFallback className="text-sm">
                      {client?.firstName?.charAt(0)}
                      {client?.lastName?.charAt(0)}
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
                                    <Badge
                                      key={substance}
                                      variant="destructive"
                                      className="text-xs"
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
                            <AlertTriangle className="text-warning dark:text-warning h-4 w-4" />
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

              <div className="space-y-1 border-t pt-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  File Names
                </div>
                <div className="space-y-2 pl-6">
                  <div>
                    <p className="text-muted-foreground text-xs">Original:</p>
                    <p className="font-mono text-sm">{originalFilename}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Will be saved as:</p>
                    <p className="text-primary font-mono text-sm font-semibold">{newFilename}</p>
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
      </div>
    )
  },
})

'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FileCheck2, Calendar, AlertTriangle, CheckCircle2, XCircle, User } from 'lucide-react'
import type { ParsedPDFData } from '@/components/views/PDFUploadWizard/types'

interface ParsedDataDisplayFieldProps {
  data: ParsedPDFData
  showRawText?: boolean
}

export default function ParsedDataDisplayField({
  data,
  showRawText = true,
}: ParsedDataDisplayFieldProps) {
  const confidenceConfig = {
    high: {
      icon: CheckCircle2,
      iconColor: 'text-green-600',
      titleColor: 'text-green-900 dark:text-green-100',
      descColor: 'text-green-800 dark:text-green-200',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    medium: {
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900 dark:text-amber-100',
      descColor: 'text-amber-800 dark:text-amber-200',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
    low: {
      icon: XCircle,
      iconColor: 'text-red-600',
      titleColor: 'text-red-900 dark:text-red-100',
      descColor: 'text-red-800 dark:text-red-200',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800',
    },
  }

  const confidence = confidenceConfig[data.confidence]
  const ConfidenceIcon = confidence.icon

  return (
    <div className="space-y-6">
      <Alert className={`${confidence.bgColor} ${confidence.borderColor}`}>
        <div className="flex items-start gap-3">
          <ConfidenceIcon className={`h-5 w-5 ${confidence.iconColor} mt-0.5 shrink-0`} />
          <div className="flex-1 space-y-1">
            <AlertTitle className={confidence.titleColor}>
              Extracted with {data.confidence.toUpperCase()} Confidence
            </AlertTitle>
            <AlertDescription>
              <p className={confidence.descColor}>
                Successfully extracted test data from the PDF. Please review the information below
                before proceeding.
              </p>
            </AlertDescription>
          </div>
        </div>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Extracted Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Donor Name
            </div>
            <p className="pl-6 text-lg font-medium">
              {data.donorName || (
                <span className="text-muted-foreground text-base italic">Not found</span>
              )}
            </p>
          </div>

          <div className="space-y-1 border-t pt-2">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Collection Date
            </div>
            <p className="pl-6 text-lg font-medium">
              {data.collectionDate ? (
                data.collectionDate.toLocaleString()
              ) : (
                <span className="text-muted-foreground text-base italic">Not found</span>
              )}
            </p>
          </div>

          {data.testType && (
            <div className="space-y-1 border-t pt-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <FileCheck2 className="h-4 w-4" />
                Detected Test Type
              </div>
              <p className="pl-6 text-lg font-medium">
                <Badge variant="outline" className="text-sm">
                  {data.testType}
                </Badge>
              </p>
            </div>
          )}

          <div className="space-y-2 border-t pt-2">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              Detected Substances
            </div>
            <div className="pl-6">
              {data.detectedSubstances.length > 0 ? (
                <div className="space-y-2">
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {data.detectedSubstances.length} Positive
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    {data.detectedSubstances.map((substance) => (
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

          {data.hasConfirmation &&
            data.confirmationResults &&
            data.confirmationResults.length > 0 && (
              <div className="space-y-2 border-t pt-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  Confirmation Results (LC-MS/MS)
                </div>
                <div className="space-y-2 pl-6">
                  {data.confirmationResults.map((result, index) => {
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
                        {result.notes && (
                          <span className="text-muted-foreground text-xs">{result.notes}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          <div className="space-y-1 border-t pt-2">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              Dilute Sample
            </div>
            <div className="pl-6">
              {data.isDilute ? (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="outline">No</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showRawText && (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <Card className="group-open:border-primary transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">View Raw Extracted Text</span>
                  <span className="text-muted-foreground text-xs group-open:hidden">
                    Click to expand
                  </span>
                  <span className="text-muted-foreground hidden text-xs group-open:inline">
                    Click to collapse
                  </span>
                </div>
              </CardContent>
            </Card>
          </summary>
          <Card className="mt-2">
            <CardContent className="pt-6">
              <pre className="bg-muted text-muted-foreground max-h-96 overflow-y-auto rounded-md p-4 text-xs whitespace-pre-wrap">
                {data.rawText}
              </pre>
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  )
}

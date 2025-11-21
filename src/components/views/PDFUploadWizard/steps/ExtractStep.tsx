'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  FileCheck2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileX2,
} from 'lucide-react'
import { extractPdfData } from '../actions'
import type { ParsedPDFData } from '../types'

interface ExtractStepProps {
  file: File
  onNext: (data: ParsedPDFData) => void
  onBack: () => void
}

export function ExtractStep({ file, onNext, onBack }: ExtractStepProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ParsedPDFData | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    async function parseFile() {
      setLoading(true)
      setError('')

      const formData = new FormData()
      formData.append('file', file)

      const result = await extractPdfData(formData)

      if (result.success && result.data) {
        setData(result.data)
      } else {
        setError(result.error || 'Unknown error occurred')
      }

      setLoading(false)
    }

    parseFile()
  }, [file])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">Extracting Data...</h2>
          <p className="text-muted-foreground">Processing your PDF file</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="space-y-4 text-center">
                <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                <p className="text-muted-foreground">Please wait while we extract the test data</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">Extraction Failed</h2>
          <p className="text-muted-foreground">Unable to process the PDF file</p>
        </div>
        <Alert variant="destructive">
          <FileX2 className="h-4 w-4" />
          <AlertDescription>
            <p className="mb-1 font-medium">{error}</p>
            <p className="text-sm">
              The PDF format may not be supported, or the file may be damaged. Please try a
              different file or contact support if this issue persists.
            </p>
          </AlertDescription>
        </Alert>
        <div className="flex justify-start">
          <Button onClick={onBack}>Back to Upload</Button>
        </div>
      </div>
    )
  }

  const confidenceConfig = {
    high: {
      variant: 'default' as const,
      icon: CheckCircle2,
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      descColor: 'text-green-800',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    medium: {
      variant: 'secondary' as const,
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      descColor: 'text-amber-800',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    low: {
      variant: 'destructive' as const,
      icon: XCircle,
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      descColor: 'text-red-800',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
  }

  const confidence = confidenceConfig[data.confidence]
  const ConfidenceIcon = confidence.icon

  return (
    <div className="space-y-6">
      <Alert className={`${confidence.bgColor} ${confidence.borderColor}`}>
        <div className="flex items-start gap-3">
          <ConfidenceIcon className={`h-5 w-5 ${confidence.iconColor} shrink-0 mt-0.5`} />
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
              <FileCheck2 className="h-4 w-4" />
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
            <pre className="text-muted-foreground bg-muted max-h-96 overflow-y-auto rounded-md p-4 text-xs whitespace-pre-wrap">
              {data.rawText}
            </pre>
          </CardContent>
        </Card>
      </details>

      <div className="flex justify-between pt-6">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={() => onNext(data)}>Next: Verify Client</Button>
      </div>
    </div>
  )
}

'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useEffect } from 'react'
import type React from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import type { ParsedPDFData } from '@/views/DrugTestWizard/types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { useExtractPdfQuery } from '@/views/DrugTestWizard/queries'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { getInstantTestFormOpts } from '../shared-form'
import { getReportClientMatch, getReportClientMismatchKey } from '../utils/reportClientMatch'
import { AlertTriangle, Calendar, CheckCircle2, ChevronDown, FileCheck2, FileX2, Loader2, User } from 'lucide-react'
import { formatSubstance } from '@/lib/substances'

function formatCollectionDate(value: string | null | undefined) {
  if (!value) return null
  return new Date(value).toLocaleString()
}

function formatTestType(value: string | null | undefined) {
  if (!value) return null
  return value.replace(/-/g, ' ')
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 py-4 first:pt-0 last:pb-0">
      <div className="text-muted-foreground flex items-center gap-2 text-base font-medium">
        {Icon && <Icon className="size-5" />}
        {label}
      </div>
      <div className="pl-7 text-2xl font-semibold tracking-tight">{children}</div>
    </div>
  )
}

export const ExtractStep = withForm({
  ...getInstantTestFormOpts(),

  render: function Render({ form }) {
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const selectedClient = useStore(form.store, (state) => state.values.client)
    const mismatchConfirmed = useStore(form.store, (state) => state.values.extract.clientMismatchConfirmed)
    const mismatchConfirmationKey = useStore(form.store, (state) => state.values.extract.clientMismatchConfirmationKey)
    const { data: extractedData, isLoading, error } = useExtractPdfQuery(uploadedFile, 'instant-test')

    // Auto-sync extracted data to form when available
    useEffect(() => {
      if (extractedData) {
        form.setFieldValue('extract.extracted', true)
        if (extractedData.testType === '17-panel-instant') {
          form.setFieldValue('verifyData.testType', extractedData.testType)
        }
        // Pre-populate verifyData with extracted values
        if (extractedData.collectionDate) {
          form.setFieldValue('verifyData.collectionDate', extractedData.collectionDate)
        }
        if (extractedData.detectedSubstances) {
          form.setFieldValue('verifyData.detectedSubstances', extractedData.detectedSubstances)
        }
        if (extractedData.isDilute !== undefined) {
          form.setFieldValue('verifyData.isDilute', extractedData.isDilute)
        }
      }
    }, [extractedData, form])

    // Loading state
    if (isLoading) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Extracting Data..." description="Processing your PDF file" />
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="space-y-4 text-center">
                  <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                  <p className="text-muted-foreground text-lg">Please wait while we extract the test data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Error state
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Extraction Failed" description="Unable to process the PDF file" />
          <Alert variant="destructive">
            <FileX2 className="h-4 w-4" />
            <AlertDescription>
              <p className="mb-1 text-base font-medium">{errorMessage}</p>
              <p className="text-sm">
                The PDF format may not be supported, or the file may be damaged. Please try a different file or contact
                support if this issue persists.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    // No data yet
    if (!extractedData) {
      return <FieldGroupHeader title="No Data" description="No file uploaded. Please go back." />
    }

    // Build ParsedPDFData object for display
    const parsedData: ParsedPDFData = {
      donorName: extractedData.donorName,
      collectionDate: extractedData.collectionDate,
      detectedSubstances: extractedData.detectedSubstances as SubstanceValue[],
      isDilute: extractedData.isDilute,
      rawText: extractedData.rawText,
      confidence: extractedData.confidence,
      extractedFields: extractedData.extractedFields,
      testType: extractedData.testType,
      hasConfirmation: extractedData.hasConfirmation,
      confirmationResults: extractedData.confirmationResults as ParsedPDFData['confirmationResults'],
    }
    const reportClientMatch = selectedClient.id ? getReportClientMatch(extractedData.donorName, selectedClient) : null
    const mismatchKey = getReportClientMismatchKey(reportClientMatch)
    const mismatchIsConfirmed = Boolean(
      reportClientMatch?.status === 'mismatch' && mismatchConfirmed && mismatchConfirmationKey === mismatchKey,
    )
    const detectedSubstances = parsedData.detectedSubstances ?? []
    const collectionDate = formatCollectionDate(parsedData.collectionDate)

    return (
      <div className="space-y-8">
        <FieldGroupHeader title="Extract Data" description="Review the extracted data" />
        {reportClientMatch?.status === 'warning' && (
          <Card className="border-amber-300 bg-amber-50/70">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700">
                  <AlertTriangle className="size-6" />
                </div>
                <div className="min-w-0 space-y-2">
                  <h3 className="text-amber-900 text-2xl font-bold tracking-tight">Name spelling does not match</h3>
                  <p className="text-amber-950/75 text-lg">
                    The report name is close to the selected client. Verify the correct spelling, then fix it in
                    ToxAccess or the Client Collection.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border-amber-300 bg-card rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Report</p>
                  <p className="text-foreground mt-2 text-2xl font-semibold">{reportClientMatch.reportName}</p>
                </div>
                <div className="border-amber-300 bg-card rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                    Selected client
                  </p>
                  <p className="text-foreground mt-2 text-2xl font-semibold">{reportClientMatch.clientName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {reportClientMatch?.status === 'mismatch' && (
          <Card className="border-destructive/70 bg-destructive/5">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-4">
                <div className="border-destructive/40 bg-destructive/10 text-destructive flex size-12 shrink-0 items-center justify-center rounded-full border">
                  <AlertTriangle className="size-6" />
                </div>
                <div className="min-w-0 space-y-2">
                  <h3 className="text-destructive text-2xl font-bold tracking-tight">Possible wrong client report</h3>
                  <p className="text-muted-foreground text-lg">
                    The report name is not close enough to the selected client. Confirm this is the correct
                    client/report before continuing.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border-destructive/30 bg-card rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Report</p>
                  <p className="text-foreground mt-2 text-2xl font-semibold">{reportClientMatch.reportName}</p>
                </div>
                <div className="border-destructive/30 bg-card rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                    Selected client
                  </p>
                  <p className="text-foreground mt-2 text-2xl font-semibold">{reportClientMatch.clientName}</p>
                </div>
              </div>

              <label className="border-destructive/40 bg-card hover:bg-muted/40 flex min-h-20 cursor-pointer items-center gap-4 rounded-lg border p-5 transition">
                <Checkbox
                  checked={mismatchIsConfirmed}
                  onCheckedChange={(checked) => {
                    form.setFieldValue('extract.clientMismatchConfirmed', checked === true)
                    form.setFieldValue('extract.clientMismatchConfirmationKey', checked === true ? mismatchKey : null)
                  }}
                  className="size-5"
                />
                <span className="text-lg font-semibold">
                  I reviewed the parsed report and confirm this is the correct client/report.
                </span>
              </label>
            </CardContent>
          </Card>
        )}
        {reportClientMatch?.status === 'unknown' && (
          <Alert className="border-amber-300">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="space-y-1">
              <p className="text-base font-semibold">Could not verify the report name against the selected client.</p>
              <p className="text-sm">
                Report name: {reportClientMatch.reportName || 'Not found'} · Selected client:{' '}
                {reportClientMatch.clientName || 'Not selected'}
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="space-y-3 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-2xl">Extracted Information</CardTitle>
              <Badge variant="outline" className="gap-2 px-3 py-1.5 text-sm">
                <CheckCircle2 className="text-success size-4" />
                Parsed with {parsedData.confidence} confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-border divide-y">
              <DetailRow icon={User} label="Donor Name">
                {parsedData.donorName || <span className="text-muted-foreground italic">Not found</span>}
              </DetailRow>

              <DetailRow icon={Calendar} label="Collection Date">
                {collectionDate || <span className="text-muted-foreground italic">Not found</span>}
              </DetailRow>

              {parsedData.testType && (
                <DetailRow icon={FileCheck2} label="Detected Test Type">
                  <Badge variant="outline" className="px-3 py-1.5 text-lg capitalize">
                    {formatTestType(parsedData.testType)}
                  </Badge>
                </DetailRow>
              )}

              <DetailRow label="Detected Substances">
                {detectedSubstances.length > 0 ? (
                  <div className="space-y-3">
                    <Badge variant="destructive" className="gap-2 px-3 py-1.5 text-base">
                      <AlertTriangle className="size-4" />
                      {detectedSubstances.length} positive
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      {detectedSubstances.map((substance) => (
                        <Badge key={substance} variant="outline" className="text-sm">
                          {formatSubstance(substance)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Badge variant="success" className="gap-2 px-3 py-1.5 text-base">
                    <CheckCircle2 className="!size-5 shrink-0" />
                    All Negative
                  </Badge>
                )}
              </DetailRow>

              <DetailRow label="Dilute Sample">
                {parsedData.isDilute ? (
                  <Badge variant="warning" className="gap-2 px-3 py-1.5 text-base">
                    <AlertTriangle className="size-4" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="px-3 py-1.5 text-base">
                    No
                  </Badge>
                )}
              </DetailRow>
            </div>
          </CardContent>
        </Card>

        <details className="group">
          <summary className="cursor-pointer list-none">
            <Card className="group-open:border-primary transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-lg font-medium">View Raw Extracted Text</span>
                  <span className="text-muted-foreground flex items-center gap-2 text-base">
                    <span className="group-open:hidden">Click to expand</span>
                    <span className="hidden group-open:inline">Click to collapse</span>
                    <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </summary>
          <Card className="mt-2">
            <CardContent className="p-6">
              <Separator className="mb-4" />
              <pre className="bg-muted text-muted-foreground max-h-96 overflow-y-auto rounded-md p-4 text-sm whitespace-pre-wrap">
                {parsedData.rawText}
              </pre>
            </CardContent>
          </Card>
        </details>
      </div>
    )
  },
})

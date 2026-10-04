'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useEffect } from 'react'
import type React from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { ParsedPDFData } from '@/views/DrugTestWizard/types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { useExtractPdfQuery } from '@/views/DrugTestWizard/queries'
import { OptionalDetails } from '../../../components/OptionalDetails'
import { ReportLink } from '../../../components/ReportLink'
import { ClientDetailsCard } from '../../components/client/ClientDetailsCard'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { getInstantTestFormOpts } from '../shared-form'
import { getReportClientMatch, getReportClientMismatchKey } from '../utils/reportClientMatch'
import { AlertTriangle, Calendar, FileCheck2, FileX2, Loader2, User } from 'lucide-react'
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
      <div className="pl-7 text-base font-semibold tracking-tight">{children}</div>
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
        <div className="flex flex-col gap-6">
          <FieldGroupHeader title="Extracting Data..." description="Processing your PDF file" />
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="space-y-4 text-center">
                  <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                  <p className="text-muted-foreground text-sm">Please wait while we extract the test data</p>
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
        <div className="flex flex-col gap-6">
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
      confidenceScore: extractedData.confidenceScore,
      confidenceReasons: extractedData.confidenceReasons,
      parseWarnings: extractedData.parseWarnings,
      resultRowCount: extractedData.resultRowCount,
      resultsComplete: extractedData.resultsComplete,
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
      <div className="flex flex-col gap-6">
        <FieldGroupHeader title="Review report data" />
        {selectedClient.id && (
          <ClientDetailsCard
            compact
            client={selectedClient}
            editable
            onClientUpdated={(updated) => {
              if (updated.firstName !== undefined) form.setFieldValue('client.firstName', updated.firstName)
              if (updated.middleInitial !== undefined) form.setFieldValue('client.middleInitial', updated.middleInitial)
              if (updated.lastName !== undefined) form.setFieldValue('client.lastName', updated.lastName)
              if (updated.email !== undefined) form.setFieldValue('client.email', updated.email)
              if (updated.dob !== undefined) form.setFieldValue('client.dob', updated.dob)
              if (updated.phone !== undefined) form.setFieldValue('client.phone', updated.phone)
              if (updated.gender !== undefined) form.setFieldValue('client.gender', updated.gender)
              if (updated.headshot !== undefined) form.setFieldValue('client.headshot', updated.headshot)
              if (updated.headshotId !== undefined) form.setFieldValue('client.headshotId', updated.headshotId)
              if (updated.referralType !== undefined) form.setFieldValue('client.referralType', updated.referralType)
              if (updated.referralTitle !== undefined) form.setFieldValue('client.referralTitle', updated.referralTitle)
            }}
          />
        )}
        <ReportLink file={uploadedFile} filename />
        {reportClientMatch?.status === 'warning' && (
          <Card className="border-warning-border bg-warning-muted">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-4">
                <div className="border-warning-border bg-warning-muted text-warning-foreground flex size-12 shrink-0 items-center justify-center rounded-full border">
                  <AlertTriangle className="size-6" />
                </div>
                <div className="min-w-0 space-y-2">
                  <h3 className="text-warning-foreground text-base font-bold tracking-tight">
                    Name spelling does not match
                  </h3>
                  <p className="text-warning-foreground text-sm">
                    The report name is close to the selected client. Verify the correct spelling, then fix it in
                    ToxAccess or the Client Collection.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-card border-warning-border rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Report</p>
                  <p className="text-foreground mt-2 text-base font-semibold">{reportClientMatch.reportName}</p>
                </div>
                <div className="bg-card border-warning-border rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                    Selected client
                  </p>
                  <p className="text-foreground mt-2 text-base font-semibold">{reportClientMatch.clientName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {reportClientMatch?.status === 'mismatch' && (
          <Card className="border-destructive/70 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="border-destructive/40 bg-destructive/10 text-destructive flex size-8 shrink-0 items-center justify-center rounded-full border">
                  <AlertTriangle className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-destructive text-base font-semibold">Possible wrong client report</h3>
                  <p className="text-muted-foreground text-sm">
                    The names do not closely match. Verify the report before continuing.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="border-destructive/30 bg-card rounded-md border px-3 py-2">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Report</p>
                  <p className="text-foreground truncate text-base font-semibold">{reportClientMatch.reportName}</p>
                </div>
                <div className="border-destructive/30 bg-card rounded-md border px-3 py-2">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Selected client
                  </p>
                  <p className="text-foreground truncate text-base font-semibold">{reportClientMatch.clientName}</p>
                </div>
              </div>

              <label className="border-destructive/40 bg-card hover:bg-muted/40 flex cursor-pointer items-center gap-3 rounded-md border p-3 transition">
                <Checkbox
                  checked={mismatchIsConfirmed}
                  onCheckedChange={(checked) => {
                    form.setFieldValue('extract.clientMismatchConfirmed', checked === true)
                    form.setFieldValue('extract.clientMismatchConfirmationKey', checked === true ? mismatchKey : null)
                  }}
                />
                <span className="text-sm font-medium">
                  I reviewed the report and confirm it belongs to this client.
                </span>
              </label>
            </CardContent>
          </Card>
        )}
        {reportClientMatch?.status === 'unknown' && (
          <Alert className="border-warning-border">
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

        <Alert variant={parsedData.resultsComplete === false ? 'warning' : 'info'}>
          <AlertDescription>
            {parsedData.resultsComplete === false
              ? 'Results incomplete — review the PDF'
              : 'Detected: ' +
                (detectedSubstances.length
                  ? detectedSubstances.map((value) => formatSubstance(value)).join(', ')
                  : 'None')}
            {parsedData.isDilute ? ' · Dilute sample' : ''}
          </AlertDescription>
        </Alert>
        <OptionalDetails title="Report details">
          <p className="text-muted-foreground text-sm">
            Parsed with {parsedData.confidence} confidence
            {typeof parsedData.confidenceScore === 'number' ? ` (${parsedData.confidenceScore}%)` : ''}
          </p>
          {parsedData.confidenceReasons?.length ? (
            <p className="text-muted-foreground text-sm">{parsedData.confidenceReasons.join(' · ')}</p>
          ) : null}
          <div className="divide-border divide-y">
            <DetailRow icon={User} label="Donor Name">
              {parsedData.donorName || <span className="text-muted-foreground italic">Not found</span>}
            </DetailRow>

            <DetailRow icon={Calendar} label="Collection Date">
              {collectionDate || <span className="text-muted-foreground italic">Not found</span>}
            </DetailRow>

            {parsedData.testType && (
              <DetailRow icon={FileCheck2} label="Detected Test Type">
                <Badge variant="outline" className="px-3 py-1.5 text-sm capitalize">
                  {formatTestType(parsedData.testType)}
                </Badge>
              </DetailRow>
            )}

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
        </OptionalDetails>
        {parsedData.parseWarnings?.map((warning) => (
          <Alert key={warning} variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))}
      </div>
    )
  },
})

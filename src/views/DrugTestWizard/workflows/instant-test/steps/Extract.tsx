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
import { useExtractPdfQuery, useComputeTestResultPreviewQuery } from '@/views/DrugTestWizard/queries'
import { OptionalDetails } from '../../../components/OptionalDetails'
import { ReportLink } from '../../../components/ReportLink'
import { ClientDetailsCard } from '../../components/client/ClientDetailsCard'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { getInstantTestFormOpts } from '../shared-form'
import { getReportClientMatch, getReportClientMismatchKey } from '../utils/reportClientMatch'
import { Button } from '@/components/ui/button'
import { useQueryState, parseAsString } from 'nuqs'
import { CollectionResultStrip } from '../../../components/CollectionResultStrip'
import { IdentityNotice } from '../../../components/IdentityNotice'
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
    const [, setStep] = useQueryState('step', parseAsString)
    const {
      data: preview,
      isFetching: previewLoading,
      isError: previewError,
    } = useComputeTestResultPreviewQuery(
      extractedData?.resultsComplete === false ? null : selectedClient.id,
      (extractedData?.detectedSubstances ?? []) as SubstanceValue[],
      extractedData?.testType === '17-panel-instant' ? '17-panel-instant' : null,
    )

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
      dob: extractedData.dob,
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
    const reportClientMatch = selectedClient.id
      ? getReportClientMatch(extractedData.donorName, selectedClient, extractedData.dob)
      : null
    const mismatchKey = getReportClientMismatchKey(reportClientMatch)
    const mismatchIsConfirmed = Boolean(
      reportClientMatch?.requiresConfirmation && mismatchConfirmed && mismatchConfirmationKey === mismatchKey,
    )
    const detectedSubstances = parsedData.detectedSubstances ?? []
    const collectionDate = formatCollectionDate(parsedData.collectionDate)

    return (
      <div className="flex flex-col gap-6">
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
        <FieldGroupHeader title="Review report data" />
        <Card>
          <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-lg font-semibold wrap-anywhere">{uploadedFile?.name || 'Report PDF'}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    form.resetField('upload.file')
                    form.setFieldValue('extract.clientMismatchConfirmed', false)
                    form.setFieldValue('extract.clientMismatchConfirmationKey', null)
                    void setStep('upload', { history: 'push' })
                  }}
                >
                  Replace PDF
                </Button>
                <ReportLink file={uploadedFile} />
              </div>
            </div>
            {reportClientMatch?.status === 'match' && (
              <p className="text-success-foreground flex items-center gap-2 text-sm">
                <FileCheck2 className="size-5" />
                {reportClientMatch.reportDob ? 'Report name and birth date match' : 'Report name matches client'}
              </p>
            )}
            {reportClientMatch && reportClientMatch.status !== 'match' && (
              <IdentityNotice
                title={
                  reportClientMatch.status === 'unknown' ||
                  (reportClientMatch.dobDifferent && (!reportClientMatch.reportDob || !reportClientMatch.clientDob))
                    ? 'Check client details in the PDF'
                    : reportClientMatch.nameDifferent && reportClientMatch.dobDifferent
                      ? "Name and birth date don't match"
                      : reportClientMatch.dobDifferent
                        ? "Birth date doesn't match"
                        : "Name doesn't match"
                }
                sourceLabel="ToxAccess report"
                rows={[
                  {
                    label: 'Name',
                    clientValue: reportClientMatch.clientName,
                    sourceValue: reportClientMatch.reportName,
                    different: reportClientMatch.nameDifferent,
                  },
                  ...(extractedData.dob
                    ? [
                        {
                          label: 'Birth date',
                          clientValue: reportClientMatch.clientDob,
                          sourceValue: reportClientMatch.reportDob || 'Not readable',
                          different: reportClientMatch.dobDifferent,
                        },
                      ]
                    : []),
                ]}
              >
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    aria-required="true"
                    data-testid="report-client-confirmation"
                    checked={mismatchIsConfirmed}
                    onCheckedChange={(checked) => {
                      form.setFieldValue('extract.clientMismatchConfirmed', checked === true)
                      form.setFieldValue('extract.clientMismatchConfirmationKey', checked === true ? mismatchKey : null)
                    }}
                  />
                  <span>This is the same person</span>
                </label>
              </IdentityNotice>
            )}
            {parsedData.resultsComplete === false ? (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>Results incomplete — review the PDF</AlertDescription>
              </Alert>
            ) : !selectedClient.id ? (
              <Alert variant="info">
                <AlertDescription>
                  Detected:{' '}
                  {detectedSubstances.length
                    ? detectedSubstances.map((value) => formatSubstance(value)).join(', ')
                    : 'None'}
                  {parsedData.isDilute ? ' · Dilute sample' : ''}
                </AlertDescription>
              </Alert>
            ) : (
              <CollectionResultStrip
                preview={preview}
                detected={detectedSubstances}
                isLoading={previewLoading}
                error={previewError}
                isDilute={parsedData.isDilute}
              />
            )}
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
          </CardContent>
        </Card>
      </div>
    )
  },
})

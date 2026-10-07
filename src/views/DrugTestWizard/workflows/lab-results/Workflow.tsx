'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { revalidateLogic, useStore } from '@tanstack/react-form'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { SetStepNav } from '@payloadcms/ui'
import { ChevronDown, ChevronRight, FileText, Loader2, Pill } from 'lucide-react'
import { toast } from 'sonner'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatSubstance } from '@/lib/substances'
import { mapTestTypeValue } from '@/config/test-types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { focusFirstInvalidFieldWithToast, useStepFocus } from '@/lib/form-scroll-focus'
import { CollectionResultStrip } from '../../components/CollectionResultStrip'
import { ReportLink } from '../../components/ReportLink'
import { OptionalDetails } from '../../components/OptionalDetails'
import { IdentityNotice } from '../../components/IdentityNotice'
import { TestCompleted } from '../../components/TestCompleted'
import { useWizardSession } from '../../components/main-wizard/WizardSessionGuard'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { ClientDetailsCard, type ClientDetailsValue } from '../components/client/ClientDetailsCard'
import { ClientSearchDialog } from '../components/client/ClientSearchDialog'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { EmailsFieldGroup } from '../components/emails/EmailsFieldGroup'
import { useLabScreenEmailPreview } from '../components/emails/useLabScreenEmailPreview'
import { useLabConfirmationEmailPreview } from '../components/emails/useLabConfirmationEmailPreview'
import {
  createConfirmationReviewRows,
  getConfirmationRequirements,
  storedConfirmationRows,
  resolvedConfirmationReview,
} from '../components/confirmation-review'
import {
  useExtractPdfQuery,
  useGetClientFromTestQuery,
  useGetDrugTestQuery,
  useComputeTestResultPreviewQuery,
  invalidateWizardClientDerivedData,
} from '../../queries'
import { calculateTestMatchScore } from '../../utils/testMatching'
import { cn } from '@/utilities/cn'
import {
  labSteps,
  reportTypes,
  legacyLabStep,
  resolveEntryMode,
  reportTypeLabel,
  reportIdentity,
  getReportClientMismatchKey,
  getLabResultsFormOpts,
  sortLabCollections,
  matchSchema,
  resultsSchema,
  uploadSchema,
  emailsGroupSchema,
  type ReportType,
} from './model'
import { useLabCollections, type LabCollection } from './collections'
import { computeFinalStatus } from '@/collections/DrugTests/services/testResults'
import { getResultPresentation } from '../../components/result-presentation'
import { LabProgress } from './Progress'
import { ConfirmationTable } from './ConfirmationTable'
import { submitLabResults } from './actions'

const date = (value?: string | null) =>
  value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString() : 'Not set'
const panel = (value?: string | null) => mapTestTypeValue(value)?.label || value?.replaceAll('-', ' ') || 'Test'

export function LabResultsWorkflow({
  onBack,
  legacyMode,
}: {
  onBack: () => void
  legacyMode?: Exclude<ReportType, 'auto'>
}) {
  const queryClient = useQueryClient()
  const { requireActiveSession, isCheckingSession } = useWizardSession()
  const [workflow, setWorkflow] = useQueryState('workflow', parseAsString)
  const [step, setStep] = useQueryState(
    'step',
    parseAsStringLiteral(labSteps).withDefault('upload').withOptions({ clearOnDefault: false }),
  )
  const [chosenClientId, setChosenClientId] = useState<string | null>(null)
  const [showAllCollections, setShowAllCollections] = useState(false)
  const [completed, setCompleted] = useState<string | null>(null)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  useStepFocus({ containerRef: formRef, stepKey: step })
  const initialFormOpts = useMemo(() => getLabResultsFormOpts(), [])
  const form = useAppForm({
    ...initialFormOpts,
    onSubmit: async ({ value }) => {
      if (!resultsSchema.safeParse(value.results).success) {
        void setStep('results')
        return
      }
      const identity = reportIdentity(extraction.data, clientQuery.data)
      if (
        identity?.requiresConfirmation &&
        (!value.matchCollection.clientMismatchConfirmed ||
          value.matchCollection.clientMismatchConfirmationKey !== getReportClientMismatchKey(identity))
      ) {
        toast.error('Check the client details before sending')
        void setStep('match')
        return
      }
      const result = await submitLabResults(value).catch(() => ({
        success: false,
        testId: undefined,
        error: 'The report could not be saved. Please try again.',
      }))
      if (result.testId) {
        setCompleted(result.testId)
        setDeliveryError(result.success ? null : (result.error ?? null))
        queryClient.invalidateQueries({ queryKey: ['lab-entry-collections'] })
        queryClient.invalidateQueries({ queryKey: ['pending-tests'] })
      } else toast.error(result.error || 'The report could not be saved')
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const submitting = useStore(form.store, (state) => state.isSubmitting)
  const extraction = useExtractPdfQuery(values.upload.file, 'lab-results')
  const collections = useLabCollections(extraction.data, values.reportType, chosenClientId)
  const orderedCollections = useMemo(
    () => sortLabCollections(collections.data ?? [], values.matchCollection.testId),
    [collections.data, values.matchCollection.testId],
  )
  const visibleCollections = showAllCollections ? orderedCollections : orderedCollections.slice(0, 3)
  const clientQuery = useGetClientFromTestQuery(values.matchCollection.testId)
  const testQuery = useGetDrugTestQuery(values.matchCollection.testId)
  const client = clientQuery.data
  const test = testQuery.data
  const mode = values.results.mode
  const report = extraction.data
  const identity = reportIdentity(report, client)
  const identityKey = getReportClientMismatchKey(identity)
  const identityConfirmed =
    !identity?.requiresConfirmation ||
    (values.matchCollection.clientMismatchConfirmed &&
      values.matchCollection.clientMismatchConfirmationKey === identityKey)
  const meds = useMemo(() => test?.medicationsArrayAtTestTime ?? [], [test?.medicationsArrayAtTestTime])
  const confirmations = useMemo(
    () =>
      resolvedConfirmationReview(
        mode === 'confirmation'
          ? values.results.confirmation.confirmationResults
          : values.results.screening.confirmationResults,
        mode === 'confirmation'
          ? values.results.confirmation.requiredSubstances
          : values.results.screening.requiredConfirmationSubstances,
      ),
    [mode, values.results.confirmation, values.results.screening],
  )
  const detected = useMemo(
    () =>
      mode === 'confirmation'
        ? values.results.confirmation.originalDetectedSubstances.filter(
            (substance) =>
              !confirmations?.some((row) => row.substance === substance && row.result === 'confirmed-negative'),
          )
        : values.results.screening.detectedSubstances,
    [
      mode,
      confirmations,
      values.results.confirmation.originalDetectedSubstances,
      values.results.screening.detectedSubstances,
    ],
  )
  const preview = useComputeTestResultPreviewQuery(
    client?.id,
    detected as SubstanceValue[],
    test?.testType,
    test?.breathalyzerTaken,
    test?.breathalyzerResult,
    meds,
  )
  const requiresDecision =
    mode === 'screening' &&
    !values.results.screening.reportHasConfirmation &&
    !!preview.data?.unexpectedPositives.length &&
    !preview.data.autoAccept
  const lastFile = useRef(values.upload.file)
  const lastType = useRef(values.reportType)
  const seeded = useRef<string | null>(null)
  const lastRecipients = useRef<string | null>(null)

  useEffect(() => {
    if (workflow === 'lab-results') return
    const current = new URL(window.location.href).searchParams.get('step')
    if (legacyMode) form.setFieldValue('reportType', legacyMode)
    void setWorkflow('lab-results', { history: 'replace' })
    void setStep(legacyLabStep(current), { history: 'replace' })
  }, [workflow, legacyMode, form, setWorkflow, setStep])
  useEffect(() => {
    if (lastFile.current !== values.upload.file || lastType.current !== values.reportType) {
      const defaults = getLabResultsFormOpts().defaultValues
      form.setFieldValue('matchCollection', defaults.matchCollection)
      form.setFieldValue('results', defaults.results)
      form.setFieldValue('emails', defaults.emails)
      seeded.current = null
      lastRecipients.current = null
      setShowAllCollections(false)
    }
    lastFile.current = values.upload.file
    lastType.current = values.reportType
  }, [values.upload.file, values.reportType, form])
  useEffect(() => {
    const reset = () => {
      form.reset()
      seeded.current = null
      lastRecipients.current = null
      setChosenClientId(null)
      setShowAllCollections(false)
      void setStep('upload')
    }
    window.addEventListener('drug-test-wizard-reset', reset)
    return () => window.removeEventListener('drug-test-wizard-reset', reset)
  }, [form, setStep])
  useEffect(() => {
    if (step !== 'upload' && !values.upload.file) void setStep('upload', { history: 'replace' })
  }, [step, values.upload.file, setStep])
  useEffect(() => {
    if (!test || !report || !values.upload.file) return
    const selectedMode = resolveEntryMode(values.reportType, report, test.screeningStatus)
    const key = JSON.stringify([
      values.upload.file.name,
      values.upload.file.size,
      values.upload.file.lastModified,
      test.id,
      selectedMode,
    ])
    if (seeded.current === key) return
    const requirements = getConfirmationRequirements(report)
    form.setFieldValue('results', {
      mode: selectedMode,
      screening: {
        ...getLabResultsFormOpts().defaultValues.results.screening,
        testType: test.testType,
        collectionDate: test.collectionDate ?? '',
        detectedSubstances: report.detectedSubstances,
        isDilute: report.specimenValidityStatus === 'unreported' ? (test.isDilute ?? false) : report.isDilute,
        reportHasConfirmation: !!report.hasConfirmation,
        confirmationResults: report.hasConfirmation ? createConfirmationReviewRows(report) : [],
        requiredConfirmationSubstances: requirements.substances,
        reviewSourceKey: key,
      },
      confirmation: {
        originalDetectedSubstances: test.detectedSubstances ?? [],
        originalIsDilute: test.isDilute ?? false,
        requiredSubstances: [...new Set([...(test.confirmationSubstances ?? []), ...requirements.substances])],
        reviewSourceKey: key,
        confirmationResults: createConfirmationReviewRows(
          report,
          test.confirmationSubstances ?? [],
          storedConfirmationRows(test.confirmationResults ?? []),
        ),
      },
      screeningVerified: report.screeningComplete === true && report.specimenValidityStatus !== 'unverified',
    })
    seeded.current = key
  }, [report, test, values.upload.file, values.reportType, form])
  useEffect(() => {
    if (!preview.data || preview.isFetching || preview.isError || mode !== 'screening') return
    form.setFieldValue('results.screening.confirmationDecisionRequired', requiresDecision)
    if (!requiresDecision) {
      form.setFieldValue('results.screening.confirmationDecision', undefined)
      form.setFieldValue('results.screening.confirmationSubstances', [])
    }
  }, [preview.data, preview.isFetching, preview.isError, mode, requiresDecision, form])
  const choose = useCallback(
    (selected: LabCollection) => {
      seeded.current = null
      form.setFieldValue('matchCollection', {
        testId: selected.id,
        clientName: selected.clientName ?? '',
        headshot: null,
        testType: selected.testType,
        collectionDate: selected.collectionDate ?? '',
        screeningStatus: selected.screeningStatus,
        matchType: 'manual',
        score: 100,
        clientMismatchConfirmed: false,
        clientMismatchConfirmationKey: null,
      })
    },
    [form],
  )
  useEffect(() => {
    if (values.matchCollection.testId || !collections.data?.length || !report) return
    const ranked = [...collections.data].sort(
      (a, b) =>
        calculateTestMatchScore(report.donorName, report.collectionDate, {
          ...b,
          clientName: b.clientName ?? '',
          collectionDate: b.collectionDate ?? '',
        }) -
        calculateTestMatchScore(report.donorName, report.collectionDate, {
          ...a,
          clientName: a.clientName ?? '',
          collectionDate: a.collectionDate ?? '',
        }),
    )
    if (
      ranked.length > 1 &&
      calculateTestMatchScore(report.donorName, report.collectionDate, {
        ...ranked[0],
        clientName: ranked[0].clientName ?? '',
        collectionDate: ranked[0].collectionDate ?? '',
      }) -
        calculateTestMatchScore(report.donorName, report.collectionDate, {
          ...ranked[1],
          clientName: ranked[1].clientName ?? '',
          collectionDate: ranked[1].collectionDate ?? '',
        }) <
        10
    )
      return
    if (
      calculateTestMatchScore(report.donorName, report.collectionDate, {
        ...ranked[0],
        clientName: ranked[0].clientName ?? '',
        collectionDate: ranked[0].collectionDate ?? '',
      }) >= 90
    )
      choose(ranked[0])
  }, [collections.data, values.matchCollection.testId, report, choose])
  const finalStatus = useMemo(
    () =>
      mode === 'confirmation' && confirmations && preview.data
        ? computeFinalStatus({
            initialScreenResult: preview.data.initialScreenResult,
            expectedPositives: preview.data.expectedPositives,
            unexpectedPositives: preview.data.unexpectedPositives,
            confirmationResults: confirmations,
            breathalyzerTaken: test?.breathalyzerTaken,
            breathalyzerResult: test?.breathalyzerResult,
          })
        : null,
    [mode, confirmations, preview.data, test?.breathalyzerTaken, test?.breathalyzerResult],
  )
  const confirmationPresentation = !confirmations
    ? { label: 'Check confirmation results', variant: 'warning' as const }
    : finalStatus === 'inconclusive'
      ? { label: 'Inconclusive', variant: 'warning' as const }
      : finalStatus === 'confirmed-negative'
        ? { label: 'Confirmed negative', variant: 'success' as const }
        : getResultPresentation(finalStatus)
  const screenEmail = useLabScreenEmailPreview({
    testId: mode === 'screening' ? test?.id : undefined,
    testType: test?.testType,
    detectedSubstances: values.results.screening.detectedSubstances as SubstanceValue[],
    isDilute: values.results.screening.isDilute,
  })
  const confirmationEmail = useLabConfirmationEmailPreview({
    testId: mode === 'confirmation' ? test?.id : undefined,
    confirmationResults: confirmations ?? [],
    originalDetectedSubstances: values.results.confirmation.originalDetectedSubstances as SubstanceValue[],
  })
  const email = mode === 'confirmation' ? confirmationEmail : screenEmail
  useEffect(() => {
    if (!email.data || !client || step !== 'review') return
    const key = JSON.stringify([client.id, email.data.clientEmail, email.data.referralEmails])
    if (lastRecipients.current === key) return
    form.setFieldValue('emails', {
      clientEmailEnabled: !!email.data.clientEmail,
      clientRecipients: email.data.clientEmail ? [email.data.clientEmail] : [],
      referralEmailEnabled: email.data.referralEmails.length > 0,
      referralRecipients: email.data.referralEmails,
    })
    lastRecipients.current = key
  }, [email.data, client, step, form])
  const updateClient = (updated: Partial<ClientDetailsValue>) => {
    queryClient.setQueryData(['client-from-test', values.matchCollection.testId], (current: typeof client) =>
      current ? { ...current, ...updated } : current,
    )
    invalidateWizardClientDerivedData(queryClient, { clientId: client?.id, testId: test?.id })
  }
  const clientPicker = (
    <ClientSearchDialog
      selectedClientId={chosenClientId ?? client?.id ?? ''}
      onSelect={(chosen) => {
        setChosenClientId(chosen.id)
        setShowAllCollections(false)
        form.setFieldValue('matchCollection', getLabResultsFormOpts().defaultValues.matchCollection)
      }}
    >
      <Button type="button" variant={client ? 'ghost' : 'outline'} size={client ? 'sm' : 'default'}>
        {client ? 'Change client' : 'Choose client'}
      </Button>
    </ClientSearchDialog>
  )
  const context = client ? (
    <div data-testid="lab-client-context">
      <ClientDetailsCard
        compact
        editable
        client={client}
        testLabel={step === 'match' ? undefined : panel(test?.testType)}
        onClientUpdated={updateClient}
        changeClientAction={step === 'match' ? clientPicker : undefined}
      />
    </div>
  ) : null
  const medicationLine = meds.length ? (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Pill className="size-4" />
      <span className="font-medium">Medication:</span>
      {meds.map((med: { medicationName?: string; detectedAs?: string[] }, at: number) => (
        <span key={at}>
          {med.medicationName}
          {med.detectedAs?.filter((value) => value !== 'none').length
            ? ` → ${med.detectedAs
                .filter((value) => value !== 'none')
                .map((value) => formatSubstance(value))
                .join(', ')}`
            : ''}
          {at < meds.length - 1 ? ' · ' : ''}
        </span>
      ))}
    </p>
  ) : null
  const resultStrip =
    mode === 'screening' && !values.results.screeningVerified ? (
      <Alert variant="warning">
        <AlertDescription>
          Check screening results in the PDF. Detected:{' '}
          {detected.length ? detected.map((value) => formatSubstance(value)).join(', ') : 'Not verified'}
        </AlertDescription>
      </Alert>
    ) : (
      <CollectionResultStrip
        preview={preview.data}
        presentation={mode === 'confirmation' ? confirmationPresentation : undefined}
        detected={detected}
        isLoading={preview.isFetching}
        error={preview.isError}
        isDilute={
          mode === 'confirmation' ? values.results.confirmation.originalIsDilute : values.results.screening.isDilute
        }
        breathalyzerTaken={test?.breathalyzerTaken}
        breathalyzerResult={test?.breathalyzerResult}
        finalPending={
          mode === 'screening' &&
          !!values.results.screening.confirmationDecision &&
          values.results.screening.confirmationDecision !== 'accept'
        }
      />
    )

  if (completed)
    return (
      <TestCompleted
        testId={completed}
        client={client ?? undefined}
        deliveryError={deliveryError}
        onBack={onBack}
        title="Lab report saved"
        progress={<LabProgress step="review" completed />}
      />
    )
  const changeReport = () => {
    form.setFieldValue('upload.file', null as unknown as File)
    void setStep('upload')
  }
  const reportBar = report && (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex max-w-full min-w-0 items-center gap-3">
          <FileText className="size-5 shrink-0" />
          <span className="truncate font-medium">{values.upload.file?.name}</span>
        </div>
        <form.Field name="reportType">
          {(field) => (
            <Field className="w-auto">
              <FieldLabel htmlFor="lab-report-type">Report type</FieldLabel>
              <Select
                items={reportTypes.map((value) => ({
                  value,
                  label:
                    value === 'auto'
                      ? `${reportTypeLabel(report).replace(' report', '')} (auto)`
                      : value === 'screening'
                        ? 'Screening'
                        : 'Confirmation',
                }))}
                value={field.state.value}
                onValueChange={(value) => field.handleChange((value ?? 'auto') as ReportType)}
              >
                <SelectTrigger id="lab-report-type" className="w-auto min-w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {reportTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === 'auto'
                          ? `${reportTypeLabel(report).replace(' report', '')} (auto)`
                          : value === 'screening'
                            ? 'Screening'
                            : 'Confirmation'}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        <div className="flex items-center gap-2">
          <ReportLink file={values.upload.file} />
          <Button type="button" variant="link" onClick={changeReport}>
            Change report
          </Button>
        </div>
        {!!report.parseWarnings?.length && (
          <Alert variant="warning">
            <AlertDescription>
              {report.parseWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
  const renderGroup = (
    name: 'upload' | 'matchCollection' | 'results' | 'emails',
    schema: Parameters<typeof form.FormGroup>[0]['validators'],
    content: ReactNode,
  ) => (
    <form.FormGroup
      key={step}
      name={name}
      validationLogic={revalidateLogic()}
      validators={schema}
      onGroupSubmit={async () => {
        if (step === 'match' && !identityConfirmed) {
          focusFirstInvalidFieldWithToast(formRef.current, 'lab-identity-required')
          return
        }
        if (step === 'review') await form.handleSubmit()
        else await setStep(labSteps[labSteps.indexOf(step) + 1], { history: 'push' })
      }}
      onGroupSubmitInvalid={() => focusFirstInvalidFieldWithToast(formRef.current, 'lab-entry-invalid')}
    >
      {(group) => (
        <>
          <div className="flex flex-col gap-6">{content}</div>
          <div className="border-border mt-8 flex items-center justify-between gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              data-testid="wizard-back-button"
              disabled={submitting}
              onClick={() => (step === 'upload' ? onBack() : void setStep(labSteps[labSteps.indexOf(step) - 1]))}
            >
              Back
            </Button>
            <Button
              type="button"
              data-testid="wizard-next-button"
              disabled={
                submitting ||
                isCheckingSession ||
                group.state.meta.isSubmitting ||
                (step === 'upload' && (!report || extraction.isFetching || !!extraction.error)) ||
                (step === 'match' && (!client || !test || !identityConfirmed)) ||
                ((step === 'results' || step === 'review') &&
                  (preview.isFetching ||
                    preview.isError ||
                    !preview.data ||
                    (mode === 'confirmation' && !confirmations) ||
                    (mode === 'screening' && values.results.screening.reportHasConfirmation && !confirmations))) ||
                (step === 'review' && (email.isLoading || !!email.error || !email.data))
              }
              onClick={async () => {
                if (await requireActiveSession()) await group.handleSubmit()
              }}
            >
              {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {step === 'upload'
                ? 'Continue to match'
                : step === 'match'
                  ? 'Continue to results'
                  : step === 'results'
                    ? 'Continue to review'
                    : 'Save & send report'}
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </>
      )}
    </form.FormGroup>
  )

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-6">
      <SetStepNav nav={[{ label: 'Lab results', url: '/admin/drug-test-upload?workflow=lab-results' }]} />
      <LabProgress step={step} />
      {step === 'upload' &&
        renderGroup(
          'upload',
          { onDynamic: uploadSchema.shape.upload },
          <>
            <FieldGroupHeader title="Upload lab report" />
            <Card>
              <CardContent
                className="flex flex-col gap-4 p-4 sm:p-6"
                data-testid={report ? 'parsed-report' : undefined}
                data-results-complete={report?.resultsComplete}
              >
                <form.AppField name="upload.file">{(field) => <field.FileUploadField reportStyle />}</form.AppField>
                {extraction.isFetching && (
                  <p className="flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Reading report…
                  </p>
                )}
                {extraction.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{extraction.error.message}</AlertDescription>
                  </Alert>
                )}
                {report && (
                  <Badge variant={report.requiresReview ? 'warning' : 'success'}>{reportTypeLabel(report)}</Badge>
                )}
              </CardContent>
            </Card>
          </>,
        )}
      {step === 'match' &&
        renderGroup(
          'matchCollection',
          { onDynamic: matchSchema },
          <>
            <FieldGroupHeader title="Match lab report" />
            {reportBar}
            {context}
            {!client && clientPicker}
            {identity?.requiresConfirmation && (
              <IdentityNotice
                title={
                  identity.nameDifferent
                    ? identity.dobDifferent
                      ? 'Check client identity'
                      : 'Check name'
                    : 'Check birth date'
                }
                sourceLabel="Lab report"
                rows={[
                  {
                    label: 'Name',
                    clientValue: identity.clientName,
                    sourceValue: identity.reportName,
                    different: identity.nameDifferent,
                  },
                  ...(report?.dob
                    ? [
                        {
                          label: 'Birth date',
                          clientValue: identity.clientDob,
                          sourceValue: identity.reportDob,
                          different: identity.dobDifferent,
                        },
                      ]
                    : []),
                ].filter((row) => row.different)}
              >
                <form.Field name="matchCollection.clientMismatchConfirmed">
                  {(field) => (
                    <Field orientation="horizontal">
                      <Checkbox
                        id="lab-identity"
                        data-testid="lab-report-identity-confirmation"
                        checked={identityConfirmed}
                        onCheckedChange={(checked) => {
                          field.handleChange(checked === true)
                          form.setFieldValue(
                            'matchCollection.clientMismatchConfirmationKey',
                            checked === true ? identityKey : null,
                          )
                        }}
                      />
                      <FieldLabel htmlFor="lab-identity">This is the same person</FieldLabel>
                    </Field>
                  )}
                </form.Field>
              </IdentityNotice>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Choose the collection</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {collections.isLoading ? (
                  <p>Loading collections…</p>
                ) : collections.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>Collections could not be loaded. Try again.</AlertDescription>
                  </Alert>
                ) : collections.data?.length ? (
                  <>
                    <div
                      id="lab-collection-choices"
                      data-testid="lab-collection-choices"
                      className="flex flex-col gap-3"
                    >
                      {visibleCollections.map((collection) => (
                        <Button
                          key={collection.id}
                          type="button"
                          variant="outline"
                          className={cn(
                            'h-auto min-h-16 w-full justify-between p-4 text-left whitespace-normal',
                            values.matchCollection.testId === collection.id && 'border-primary bg-primary/5',
                          )}
                          data-testid={`pending-test-${collection.id}`}
                          aria-pressed={values.matchCollection.testId === collection.id}
                          onClick={() => choose(collection)}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                'border-border flex size-5 shrink-0 items-center justify-center rounded-full border',
                                values.matchCollection.testId === collection.id && 'border-primary',
                              )}
                            >
                              {values.matchCollection.testId === collection.id && (
                                <span className="bg-primary size-2.5 rounded-full" />
                              )}
                            </span>
                            <span className="flex flex-col gap-1">
                              <span>
                                {chosenClientId
                                  ? `${panel(collection.testType)} · ${date(collection.collectionDate)}`
                                  : collection.clientName}
                              </span>
                              {!chosenClientId && (
                                <span className="text-muted-foreground text-sm">
                                  {panel(collection.testType)} · {date(collection.collectionDate)}
                                </span>
                              )}
                            </span>
                          </span>
                          <Badge variant={collection.screeningStatus === 'collected' ? 'secondary' : 'warning'}>
                            {collection.screeningStatus === 'collected' ? 'Awaiting results' : 'Awaiting confirmation'}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                    {orderedCollections.length > 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        data-testid="lab-collection-more"
                        aria-expanded={showAllCollections}
                        aria-controls="lab-collection-choices"
                        onClick={() => setShowAllCollections((open) => !open)}
                      >
                        <ChevronDown
                          data-icon="inline-start"
                          className={cn('transition-transform', showAllCollections && 'rotate-180')}
                        />
                        {showAllCollections
                          ? 'Show fewer collections'
                          : `Show ${orderedCollections.length - 3} more collections`}
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No eligible collections. Choose another client or check the report type.
                  </p>
                )}
                <form.Field name="matchCollection.testId">
                  {(field) => <FieldError errors={field.state.meta.errors} />}
                </form.Field>
              </CardContent>
            </Card>
          </>,
        )}
      {step === 'results' &&
        renderGroup(
          'results',
          { onDynamic: resultsSchema },
          <>
            <FieldGroupHeader title="Review lab results" />
            {context}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{mode === 'confirmation' ? 'Confirmation report' : reportTypeLabel(report)}</CardTitle>
                <ReportLink file={values.upload.file} />
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {resultStrip}
                {medicationLine}
                {mode === 'confirmation' ? (
                  <form.Field name="results.confirmation.confirmationResults">
                    {(field) => (
                      <ConfirmationTable
                        rows={field.state.value}
                        report={report}
                        expected={preview.data?.expectedPositives ?? []}
                        required={values.results.confirmation.requiredSubstances}
                        onChange={field.handleChange}
                        errors={field.state.meta.errors}
                      />
                    )}
                  </form.Field>
                ) : (
                  values.results.screening.reportHasConfirmation && (
                    <form.Field name="results.screening.confirmationResults">
                      {(field) => (
                        <ConfirmationTable
                          rows={field.state.value}
                          report={report}
                          expected={preview.data?.expectedPositives ?? []}
                          required={values.results.screening.requiredConfirmationSubstances}
                          onChange={field.handleChange}
                          errors={field.state.meta.errors}
                        />
                      )}
                    </form.Field>
                  )
                )}
                <form.Field name="results.screeningVerified">
                  {(field) =>
                    mode === 'screening' &&
                    (report?.screeningComplete !== true || report?.specimenValidityStatus === 'unverified') ? (
                      <Field orientation="horizontal">
                        <Checkbox
                          id="verify-lab-screen"
                          checked={field.state.value}
                          onCheckedChange={(checked) => field.handleChange(checked === true)}
                        />
                        <FieldLabel htmlFor="verify-lab-screen">I checked the screening results in the PDF</FieldLabel>
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    ) : null
                  }
                </form.Field>
              </CardContent>
            </Card>
            {mode === 'screening' && (
              <>
                <div hidden={!requiresDecision}>
                  <form.Field name="results.screening.confirmationDecision">
                    {(field) => (
                      <FieldGroup>
                        <FieldLabel>Result decision</FieldLabel>
                        <RadioGroup
                          value={field.state.value ?? ''}
                          aria-invalid={field.state.meta.errors.length > 0}
                          onValueChange={(value) => {
                            field.handleChange(value as 'accept' | 'request-confirmation' | 'pending-decision')
                            if (
                              value === 'request-confirmation' &&
                              !values.results.screening.confirmationSubstances?.length
                            )
                              form.setFieldValue(
                                'results.screening.confirmationSubstances',
                                preview.data?.unexpectedPositives ?? [],
                              )
                          }}
                          className="flex flex-wrap gap-6"
                        >
                          {[
                            { id: 'accept', label: 'Accept result' },
                            { id: 'request-confirmation', label: 'Request confirmation' },
                            { id: 'pending-decision', label: 'Decide later' },
                          ].map((choice) => (
                            <Field key={choice.id} orientation="horizontal">
                              <RadioGroupItem value={choice.id} id={choice.id} />
                              <FieldLabel htmlFor={choice.id}>{choice.label}</FieldLabel>
                            </Field>
                          ))}
                        </RadioGroup>
                        <FieldError errors={field.state.meta.errors} />
                      </FieldGroup>
                    )}
                  </form.Field>
                  <form.Field name="results.screening.confirmationSubstances">
                    {(field) =>
                      values.results.screening.confirmationDecision === 'request-confirmation' ? (
                        <ConfirmationSubstanceSelector
                          unexpectedPositives={preview.data?.unexpectedPositives ?? []}
                          selectedSubstances={field.state.value ?? []}
                          onSelectionChange={field.handleChange}
                          error={field.state.meta.errors[0] ? 'Choose at least one substance' : undefined}
                        />
                      ) : null
                    }
                  </form.Field>
                </div>
                <OptionalDetails title="Edit test details">
                  <p className="text-sm">
                    {panel(test?.testType)} · Collected {date(test?.collectionDate)}
                  </p>
                  <form.AppField name="results.screening.detectedSubstances">
                    {(field) => <field.SubstanceChecklistField testType={test?.testType ?? '11-panel-lab'} />}
                  </form.AppField>
                  <form.Field name="results.screening.isDilute">
                    {(field) => (
                      <Field orientation="horizontal">
                        <Checkbox
                          id="isDilute"
                          checked={field.state.value}
                          onCheckedChange={(checked) => field.handleChange(checked === true)}
                        />
                        <FieldLabel htmlFor="isDilute">Sample is dilute</FieldLabel>
                      </Field>
                    )}
                  </form.Field>
                </OptionalDetails>
              </>
            )}
          </>,
        )}
      {step === 'review' &&
        renderGroup(
          'emails',
          { onDynamic: emailsGroupSchema },
          <>
            <FieldGroupHeader title="Review result & recipients" />
            {context}
            {resultStrip}
            <EmailsFieldGroup
              title="Review recipients"
              description=""
              form={form}
              fields="emails"
              hideHeader
              attachment={<ReportLink file={values.upload.file} filename />}
              previewData={email.data ?? null}
              isLoading={email.isLoading}
              error={email.error?.message ?? null}
              showPreview={showEmailPreview}
              setShowPreview={setShowEmailPreview}
              showClientEmail
              clientId={client?.id ?? null}
              onClientEmailSaved={() =>
                invalidateWizardClientDerivedData(queryClient, { clientId: client?.id, testId: test?.id })
              }
              onReferralProfileSaved={() =>
                invalidateWizardClientDerivedData(queryClient, { clientId: client?.id, testId: test?.id })
              }
            />
          </>,
        )}
    </form>
  )
}

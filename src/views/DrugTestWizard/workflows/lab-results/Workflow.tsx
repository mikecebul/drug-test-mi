'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { revalidateLogic, useStore } from '@tanstack/react-form'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { SetStepNav } from '@payloadcms/ui'
import { ChevronDown, ChevronRight, FileText, Loader2, Pill, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatSubstance } from '@/lib/substances'
import { formatCollectionDateTimeCompact } from '@/lib/date-utils'
import { mapTestTypeValue } from '@/config/test-types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { focusFirstInvalidFieldWithToast, useStepFocus } from '@/lib/form-scroll-focus'
import { CollectionResultStrip } from '../../components/CollectionResultStrip'
import { ReportLink } from '../../components/ReportLink'
import { IdentityNotice } from '../../components/IdentityNotice'
import { TestCompleted } from '../../components/TestCompleted'
import { useWizardSession } from '../../components/main-wizard/WizardSessionGuard'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { ClientDetailsCard, type ClientDetailsValue } from '../components/client/ClientDetailsCard'
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
  matchStepSchema,
  resultsSchema,
  uploadSchema,
  emailsGroupSchema,
  type ReportType,
} from './model'
import { useLabCollections, type LabCollection } from './collections'
import { computeFinalStatus } from '@/collections/DrugTests/services/testResults'
import { getResultPresentation } from '../../components/result-presentation'
import { LabProgress } from './Progress'
import { ScreeningResults } from './ScreeningResults'
import { ConfirmationTable } from './ConfirmationTable'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { confirmationPrice, referralPaysConfirmation } from '@/collections/DrugTests/confirmation/policy'
import { submitLabResults, prepareLabResultDecision } from './actions'

const date = formatCollectionDateTimeCompact
const reportTypeLabels = { auto: 'Detect from PDF', screening: 'Screening', confirmation: 'Confirmation' }
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
  const [showAllCollections, setShowAllCollections] = useState(false)
  const [completed, setCompleted] = useState<string | null>(null)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [preparedDecision, setPreparedDecision] = useState<{
    testId: string
    screenedAt?: string | null
    confirmationHoldUntil?: string | null
    paymentRequired: boolean
    billedToReferral: boolean
  } | null>(null)
  const [reportEditorOpen, setReportEditorOpen] = useState(false)
  const reportEditorSnapshot = useRef<ReturnType<typeof getLabResultsFormOpts>['defaultValues']['results'] | null>(null)
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
  const collections = useLabCollections(extraction.data, values.reportType)
  const orderedCollections = sortLabCollections(
    collections.data ?? [],
    values.matchCollection.testId,
    extraction.data?.donorName,
  )
  const visibleCollections = showAllCollections ? orderedCollections : orderedCollections.slice(0, 3)
  const clientQuery = useGetClientFromTestQuery(values.matchCollection.testId)
  const testQuery = useGetDrugTestQuery(values.matchCollection.testId)
  const client = clientQuery.data
  const test = testQuery.data
  const mode = values.results.mode
  const referralBilled =
    preparedDecision && preparedDecision.testId === test?.id
      ? preparedDecision.billedToReferral
      : referralPaysConfirmation(test || {})
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
    !!preview.data &&
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
      setPreparedDecision(null)
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
        screeningResultDate: test.screenedAt || new Date().toISOString(),
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
      emailConfirmationPaymentLink: true,
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
    confirmationDecision: values.results.screening.confirmationDecision,
    confirmationSubstances: values.results.screening.confirmationSubstances,
    confirmationPaymentRequired:
      preparedDecision && preparedDecision.testId === test?.id ? preparedDecision.paymentRequired : false,
    confirmationHoldUntil:
      preparedDecision && preparedDecision.testId === test?.id ? preparedDecision.confirmationHoldUntil : undefined,
    confirmationCompleted: !!confirmations?.length && values.results.screening.reportHasConfirmation,
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
    queryClient.invalidateQueries({ queryKey: ['lab-entry-collections'] })
  }
  const identityNotice = (
    <form.Field name="matchCollection.clientMismatchConfirmed">
      {(field) =>
        identity?.requiresConfirmation ? (
          <IdentityNotice
            title={
              identity.nameDifferent
                ? identity.dobDifferent
                  ? 'Check client identity'
                  : 'Name differs'
                : 'Birth date differs'
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
            <FieldGroup className="gap-2">
              <Field orientation="horizontal" data-invalid={field.state.meta.errors.length > 0}>
                <Checkbox
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby="lab-identity-error"
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
                <FieldLabel htmlFor="lab-identity">I verified this is the same person</FieldLabel>
              </Field>
              <FieldError id="lab-identity-error" errors={field.state.meta.errors} />
            </FieldGroup>
          </IdentityNotice>
        ) : null
      }
    </form.Field>
  )
  const context = client ? (
    <div data-testid="lab-client-context">
      <ClientDetailsCard
        compact
        editable
        client={client}
        testLabel={step === 'match' ? undefined : panel(test?.testType)}
        onClientUpdated={updateClient}
        identityNotice={step === 'match' && identity?.requiresConfirmation ? identityNotice : undefined}
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
      <CardContent className="grid items-start gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-start gap-3">
          <FileText className="mt-0.5 size-5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium" title={values.upload.file?.name}>
              {values.upload.file?.name}
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <ReportLink file={values.upload.file} compact />
              <Button type="button" variant="link" size="sm" className="h-auto min-h-8 px-0" onClick={changeReport}>
                Replace PDF
              </Button>
            </div>
          </div>
        </div>
        <form.Field name="reportType">
          {(field) => (
            <Field className="w-auto gap-1">
              <FieldLabel htmlFor="lab-report-type" className="text-muted-foreground text-xs">
                Report type
              </FieldLabel>
              <Select
                items={reportTypes.map((value) => ({
                  value,
                  label: reportTypeLabels[value],
                }))}
                value={field.state.value}
                onValueChange={(value) => field.handleChange((value ?? 'auto') as ReportType)}
              >
                <SelectTrigger id="lab-report-type" size="sm" className="w-36">
                  <SelectValue>
                    {field.state.value === 'auto'
                      ? report.reportKind === 'screening-and-confirmation'
                        ? 'Combined'
                        : reportTypeLabel(report).replace(' report', '')
                      : reportTypeLabels[field.state.value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {reportTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {reportTypeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        {!!report.parseWarnings?.length && (
          <Alert variant="warning" className="sm:col-span-2">
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
  const openReportEditor = () => {
    reportEditorSnapshot.current = structuredClone(form.state.values.results)
    setReportEditorOpen(true)
  }
  const closeReportEditor = (apply: boolean) => {
    if (!apply && reportEditorSnapshot.current) form.setFieldValue('results', reportEditorSnapshot.current)
    reportEditorSnapshot.current = null
    setReportEditorOpen(false)
  }
  const reportEditor = (
    <Drawer open={reportEditorOpen} onOpenChange={(open) => !open && closeReportEditor(false)} swipeDirection="right">
      <DrawerContent
        // Keep TanStack correction fields registered when the drawer is closed.
        keepMounted
        className="[--drawer-content-width:min(100vw,32rem)] sm:[--drawer-content-width:32rem]"
      >
        <DrawerHeader>
          <DrawerTitle>Edit screening results</DrawerTitle>
          <DrawerDescription>Correct the results to match the PDF.</DrawerDescription>
        </DrawerHeader>
        <FieldGroup className="min-h-0 flex-1 overflow-y-auto p-4">
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
        </FieldGroup>
        <DrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => closeReportEditor(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => closeReportEditor(true)}>
            Apply changes
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
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
        if (step === 'results' && mode === 'screening') {
          if (!(await requireActiveSession())) return
          const prepared = await prepareLabResultDecision(form.state.values)
          if (!prepared.success) {
            toast.error(prepared.error)
            return
          }
          if (prepared.prepared) {
            setPreparedDecision(prepared.prepared)
            if (prepared.prepared.screenedAt)
              form.setFieldValue('results.screening.screeningResultDate', prepared.prepared.screenedAt)
          }
          // Keep the reviewed form snapshot stable while the prepared fee updates the tracker.
          void queryClient.invalidateQueries({ queryKey: ['pending-tests'] })
        }
        if (step === 'review') await form.handleSubmit()
        else await setStep(labSteps[labSteps.indexOf(step) + 1], { history: 'push' })
      }}
      onGroupSubmitInvalid={() => focusFirstInvalidFieldWithToast(formRef.current, 'lab-entry-invalid')}
    >
      {(group) => (
        <>
          <div className="flex flex-col gap-6">{content}</div>
          {step === 'results' && mode === 'screening' && reportEditor}
          <div className="border-border mt-8 flex items-center justify-between gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              data-testid="wizard-back-button"
              disabled={submitting || group.state.meta.isSubmitting}
              onClick={() => (step === 'upload' ? onBack() : void setStep(labSteps[labSteps.indexOf(step) - 1]))}
            >
              Back
            </Button>
            <Button
              type="button"
              data-testid="wizard-next-button"
              aria-busy={submitting || group.state.meta.isSubmitting || isCheckingSession}
              onClick={async () => {
                if (submitting || group.state.meta.isSubmitting) return
                if (await requireActiveSession()) {
                  if (form.state.isSubmitting || group.state.meta.isSubmitting) return
                  // Async checks can finish without a field value change; refresh the active group's readiness errors.
                  await group.validate('submit', { skipRelatedFieldValidation: true })
                  if (form.state.isSubmitting || group.state.meta.isSubmitting) return
                  await group.handleSubmit()
                }
              }}
            >
              {(submitting || group.state.meta.isSubmitting) && (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              )}
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
          {
            onDynamic: uploadSchema.shape.upload.superRefine((_, ctx) => {
              if (!report || extraction.isFetching || extraction.error)
                ctx.addIssue({
                  code: 'custom',
                  message: extraction.error
                    ? 'This PDF could not be read. Replace it with a readable report.'
                    : 'Wait for the PDF to finish reading before continuing',
                  path: ['file'],
                })
            }),
          },
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
          {
            onDynamic: matchStepSchema(identity?.requiresConfirmation ? identityKey : null).superRefine(
              (value, ctx) => {
                if (value.testId && (!client || !test))
                  ctx.addIssue({
                    code: 'custom',
                    message:
                      clientQuery.isError || testQuery.isError
                        ? 'Client or collection could not be loaded. Choose the collection again.'
                        : 'Choose a collection and wait for its client to load',
                    path: ['testId'],
                  })
              },
            ),
          },
          <>
            <FieldGroupHeader title="Match lab report" />
            {reportBar}
            {context}
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
                              data-slot="collection-choice-indicator"
                              className={cn(
                                'border-muted-foreground bg-background flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                                values.matchCollection.testId === collection.id && 'border-primary',
                              )}
                            >
                              {values.matchCollection.testId === collection.id && (
                                <span className="bg-primary size-2.5 rounded-full" />
                              )}
                            </span>
                            <span className="flex flex-col gap-1">
                              <span>{collection.clientName}</span>
                              <span className="text-muted-foreground text-sm">
                                {panel(collection.testType)} · {date(collection.collectionDate)}
                              </span>
                            </span>
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs font-normal">
                            {collection.screeningStatus === 'collected' ? 'Awaiting results' : 'Awaiting confirmation'}
                          </span>
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
          {
            onDynamic: resultsSchema.superRefine((value, ctx) => {
              if (!preview.data || preview.isFetching || preview.isError)
                ctx.addIssue({
                  code: 'custom',
                  message: preview.isError
                    ? 'Results could not be verified. Retry before continuing.'
                    : 'Wait for the results to finish checking',
                  path: value.mode === 'screening' ? ['screeningVerified'] : ['confirmation', 'confirmationResults'],
                })
            }),
          },
          <>
            <FieldGroupHeader title="Review lab results" />
            {context}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{mode === 'confirmation' ? 'Confirmation report' : reportTypeLabel(report)}</CardTitle>
                <div className="flex items-center gap-2">
                  {mode === 'screening' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={openReportEditor}
                      data-testid="edit-screening-report"
                    >
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                  )}
                  <ReportLink file={values.upload.file} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {mode === 'screening' ? (
                  <ScreeningResults
                    preview={preview.data}
                    detected={detected}
                    medications={meds}
                    verified={values.results.screeningVerified}
                    isLoading={preview.isFetching}
                    error={preview.isError}
                    isDilute={values.results.screening.isDilute}
                    breathalyzerTaken={test?.breathalyzerTaken}
                    breathalyzerResult={test?.breathalyzerResult}
                  />
                ) : (
                  <>
                    {resultStrip}
                    {medicationLine}
                  </>
                )}
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
                    ) : (
                      <FieldError errors={field.state.meta.errors} />
                    )
                  }
                </form.Field>
              </CardContent>
            </Card>
            {mode === 'screening' && (
              <>
                <FieldGroup hidden={!requiresDecision} className={cn('gap-4', !requiresDecision && 'hidden')}>
                  <form.Field name="results.screening.confirmationDecision">
                    {(field) => (
                      <FieldGroup>
                        <FieldLabel id="lab-result-decision-label">Result decision</FieldLabel>
                        <RadioGroup
                          value={field.state.value ?? ''}
                          aria-labelledby="lab-result-decision-label"
                          tabIndex={-1}
                          aria-invalid={field.state.meta.errors.length > 0}
                          onValueChange={(value) => {
                            field.handleChange(value as 'accept' | 'request-confirmation' | 'pending-decision')
                            if (
                              value === 'request-confirmation' &&
                              !values.results.screening.confirmationSubstances?.length
                            )
                              form.setFieldValue('results.screening.confirmationSubstances', [
                                ...new Set([
                                  ...(preview.data?.unexpectedPositives ?? []),
                                  ...(preview.data?.unexpectedNegatives ?? []),
                                ]),
                              ])
                          }}
                          className="grid gap-2"
                        >
                          {[
                            {
                              id: 'accept',
                              label: 'Accept result',
                              description: 'Finish this test. Stop tracking it.',
                            },
                            {
                              id: 'request-confirmation',
                              label: 'Request confirmation',
                              description: referralBilled
                                ? `$${confirmationPrice(test?.testType || '')} per substance. Billed to the referral.`
                                : `$${confirmationPrice(test?.testType || '')} per substance. Payment before the lab request.`,
                            },
                            {
                              id: 'pending-decision',
                              label: 'Decide later',
                              description: 'Track for 30 days from the screening result date.',
                            },
                          ].map((choice) => (
                            <Field
                              key={choice.id}
                              data-testid={`confirmation-decision-${choice.id}`}
                              orientation="vertical"
                              onClick={(event) => {
                                const target = event.target as HTMLElement
                                if (
                                  target.closest(
                                    'button,input,select,textarea,a,label,[role="checkbox"],[role="radio"],[data-testid="confirmation-request-options"]',
                                  )
                                )
                                  return
                                if (field.state.value === choice.id) return
                                field.handleChange(choice.id as 'accept' | 'request-confirmation' | 'pending-decision')
                                if (
                                  choice.id === 'request-confirmation' &&
                                  !form.state.values.results.screening.confirmationSubstances?.length
                                )
                                  form.setFieldValue('results.screening.confirmationSubstances', [
                                    ...new Set([
                                      ...(preview.data?.unexpectedPositives || []),
                                      ...(preview.data?.unexpectedNegatives || []),
                                    ]),
                                  ])
                              }}
                              className={cn(
                                'cursor-pointer rounded-lg border p-4',
                                field.state.value === choice.id && 'border-primary bg-primary/5',
                              )}
                            >
                              <Field orientation="horizontal">
                                <RadioGroupItem
                                  value={choice.id}
                                  id={choice.id}
                                  aria-describedby={`${choice.id}-description`}
                                />
                                <div className="min-w-0">
                                  <FieldLabel id={`${choice.id}-label`} htmlFor={choice.id} className="cursor-pointer">
                                    {choice.label}
                                  </FieldLabel>
                                  <FieldDescription id={`${choice.id}-description`}>
                                    {choice.description}
                                  </FieldDescription>
                                </div>
                              </Field>
                              {choice.id === 'request-confirmation' && (
                                <FieldGroup
                                  aria-labelledby="request-confirmation-label"
                                  data-testid="confirmation-request-options"
                                  hidden={field.state.value !== choice.id}
                                  className={cn(
                                    'border-border gap-4 border-t pt-4 sm:pl-7',
                                    field.state.value !== choice.id && 'hidden',
                                  )}
                                >
                                  <form.Field name="results.screening.confirmationSubstances">
                                    {(field) =>
                                      values.results.screening.confirmationDecision === 'request-confirmation' ? (
                                        <ConfirmationSubstanceSelector
                                          compact
                                          unexpectedPositives={[
                                            ...new Set([
                                              ...(preview.data?.unexpectedPositives ?? []),
                                              ...(preview.data?.unexpectedNegatives ?? []),
                                            ]),
                                          ]}
                                          selectedSubstances={field.state.value ?? []}
                                          onSelectionChange={field.handleChange}
                                          invalid={field.state.meta.errors.length > 0}
                                          error={
                                            field.state.meta.errors[0] ? 'Choose at least one substance' : undefined
                                          }
                                        />
                                      ) : null
                                    }
                                  </form.Field>
                                  {!referralBilled && (
                                    <form.Field name="results.emailConfirmationPaymentLink">
                                      {(field) => (
                                        <Field orientation="horizontal">
                                          <Checkbox
                                            id="email-confirmation-payment"
                                            checked={field.state.value}
                                            onCheckedChange={(value) => field.handleChange(value === true)}
                                          />
                                          <div>
                                            <FieldLabel htmlFor="email-confirmation-payment">
                                              Email client a Stripe payment link
                                            </FieldLabel>
                                            <FieldDescription>Admin notified when payment clears.</FieldDescription>
                                          </div>
                                        </Field>
                                      )}
                                    </form.Field>
                                  )}
                                </FieldGroup>
                              )}
                            </Field>
                          ))}
                        </RadioGroup>
                        <FieldError errors={field.state.meta.errors} />
                      </FieldGroup>
                    )}
                  </form.Field>
                </FieldGroup>
              </>
            )}
          </>,
        )}
      {step === 'review' &&
        renderGroup(
          'emails',
          {
            onDynamic: emailsGroupSchema.superRefine((_, ctx) => {
              if (email.isLoading || email.error || !email.data)
                ctx.addIssue({
                  code: 'custom',
                  message: email.error
                    ? 'Email preview could not be loaded. Retry before sending.'
                    : 'Wait for the email preview to finish loading',
                  path: ['clientRecipients'],
                })
            }),
          },
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
                // Keep the reviewed form snapshot stable while the prepared fee updates the tracker.
                void queryClient.invalidateQueries({ queryKey: ['pending-tests'] })
              }
              onReferralProfileSaved={() =>
                // Keep the reviewed form snapshot stable while the prepared fee updates the tracker.
                void queryClient.invalidateQueries({ queryKey: ['pending-tests'] })
              }
            />
          </>,
        )}
    </form>
  )
}

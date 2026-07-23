'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic, useStore } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral, parseAsString } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getInstantTestFormOpts } from './shared-form'
import type { InstantTestType } from './shared-form'
import { InstantTestNavigation } from './components/Navigation'
import { UploadStep } from './steps/Upload'
import { ExtractStep } from './steps/Extract'
import { ClientStep } from './steps/Client/Step'
import { MedicationsStep } from './steps/Medications'
import { VerifyDataStep } from './steps/VerifyData'
import { ConfirmStep } from './steps/confirm/Step'
import { EmailsStep } from './steps/Emails'
import { createInstantTest } from './actions/createInstantTest'
import { TestCompleted } from '../../components/TestCompleted'
import {
  clientSchema,
  emailsGroupSchema,
  extractSchema,
  medicationsSchema,
  steps,
  uploadSchema,
  verifyDataSchema,
} from './validators'
import { extractPdfQueryKey, prefetchExtractPdf } from '../../queries'
import type { ExtractedPdfData } from '../../queries'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { getClientByBookingId, getClientById } from '../components/client/getClients'
import { getFileFromStorage, clearFileStorage, hasStoredFile, saveFileToStorage } from './utils/fileStorage'
import { focusFirstInvalidFieldWithToast, useStepFocus } from '@/lib/form-scroll-focus'
import { getReportClientMatch, getReportClientMismatchKey } from './utils/reportClientMatch'

interface InstantTestWorkflowProps {
  onBack: () => void
}

export function InstantTestWorkflow({ onBack }: InstantTestWorkflowProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)
  const [isRestoringFile, setIsRestoringFile] = useState(true)

  // Wrap onBack to clear storage when navigating away
  const handleBack = () => {
    clearFileStorage()
    onBack()
  }

  // URL is single source of truth
  const [currentStep, setCurrentStep] = useQueryState('step', parseAsStringLiteral(steps).withDefault('upload'))

  // Manage clientId param for pre-populating from registration workflow
  const [clientId, setClientId] = useQueryState('clientId', parseAsString)
  const [bookingId] = useQueryState('bookingId', parseAsString)
  const hydratedClientIdRef = useRef<string | null>(null)
  const hasRunInitialRestoreRef = useRef(false)
  const initialTestType: InstantTestType = '17-panel-instant'
  const formRef = useRef<HTMLFormElement | null>(null)

  useStepFocus({
    containerRef: formRef,
    stepKey: currentStep,
  })

  const form = useAppForm({
    ...getInstantTestFormOpts(initialTestType),
    onSubmit: async ({ value }) => {
      // Final submit: Create drug test
      console.log(`[InstantTest] Starting final submission...`)
      try {
        const queryKey = extractPdfQueryKey(value.upload.file, 'instant-test')
        const extractedData = queryClient.getQueryData<ExtractedPdfData>(queryKey)
        console.log(`[InstantTest] Extracted data from query cache:`, extractedData ? 'found' : 'not found')

        if (extractedData?.testType === '15-panel-instant') {
          toast.error('15-panel instant tests are no longer supported. Upload a 17-panel instant report.', {
            id: 'instant-test-unsupported-15-panel',
          })
          await setCurrentStep('extract', { history: 'push' })
          return
        }

        const reportClientMatch = getReportClientMatch(extractedData?.donorName, value.client)
        const mismatchKey = getReportClientMismatchKey(reportClientMatch)

        if (
          reportClientMatch.status === 'mismatch' &&
          (!value.extract.clientMismatchConfirmed || value.extract.clientMismatchConfirmationKey !== mismatchKey)
        ) {
          toast.error('Confirm the report/client mismatch before submitting.', {
            id: 'instant-test-report-client-mismatch',
          })
          await setCurrentStep('extract', { history: 'push' })
          return
        }

        // Convert File to buffer array
        console.log(`[InstantTest] Converting file to array buffer...`)
        const arrayBuffer = await value.upload.file.arrayBuffer()
        const pdfBuffer = Array.from(new Uint8Array(arrayBuffer))
        console.log(`[InstantTest] Buffer conversion complete`)

        // Log payload sizes for debugging
        const originalSizeMB = (value.upload.file.size / 1024 / 1024).toFixed(2)
        const bufferSizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2)
        const jsonSizeMB = (JSON.stringify(pdfBuffer).length / 1024 / 1024).toFixed(2)
        console.log(
          `[InstantTest] PDF Sizes - Original: ${originalSizeMB}MB, Buffer: ${bufferSizeMB}MB, JSON: ${jsonSizeMB}MB`,
        )

        console.log(`[InstantTest] Calling createInstantTest server action...`)

        const result = await createInstantTest(
          {
            clientId: value.client.id,
            bookingId,
            testType: value.verifyData.testType,
            collectionDate: value.verifyData.collectionDate,
            detectedSubstances: value.verifyData.detectedSubstances as SubstanceValue[],
            isDilute: value.verifyData.isDilute,
            breathalyzerTaken: value.verifyData.breathalyzerTaken,
            breathalyzerResult: value.verifyData.breathalyzerResult ?? null,
            pdfBuffer,
            pdfFilename: value.upload.file.name,
            hasConfirmation: extractedData?.hasConfirmation,
            confirmationResults: extractedData?.confirmationResults,
            confirmationDecision: value.verifyData.confirmationDecision ?? null,
            confirmationSubstances: value.verifyData.confirmationSubstances as SubstanceValue[] | undefined,
          },
          value.medications,
          {
            clientEmailEnabled: value.emails.clientEmailEnabled,
            clientRecipients: value.emails.clientEmailEnabled ? value.emails.clientRecipients : [],
            referralEmailEnabled: value.emails.referralEmailEnabled,
            referralRecipients: value.emails.referralRecipients,
          },
        )

        console.log(`[InstantTest] Server action returned:`, result)

        if (result.success && result.testId) {
          console.log(`[InstantTest] Success! Test ID: ${result.testId}`)
          setCompletedTestId(result.testId)
          // Clear stored file after successful submission
          clearFileStorage()
        } else {
          console.error(`[InstantTest] Server action failed:`, result.error)
          toast.error(result.error || 'Failed to create drug test')
        }
      } catch (error) {
        console.error('[InstantTest] Unexpected error during submission:', error)
        toast.error('An unexpected error occurred. Please try again.')
      }
    },
  })
  const hydrateExtractedData = useCallback(
    (extractedData: ExtractedPdfData) => {
      form.setFieldValue('extract.extracted', true)
      if (extractedData.testType === '17-panel-instant') {
        form.setFieldValue('verifyData.testType', extractedData.testType)
      }
      if (extractedData.collectionDate) {
        form.setFieldValue('verifyData.collectionDate', extractedData.collectionDate)
      }
      if (extractedData.detectedSubstances) {
        form.setFieldValue('verifyData.detectedSubstances', extractedData.detectedSubstances)
      }
      if (extractedData.isDilute !== undefined) {
        form.setFieldValue('verifyData.isDilute', extractedData.isDilute)
      }
    },
    [form],
  )
  const uploadedFile = useStore(form.store, (state) => state.values.upload.file)

  // The stored PDF only bridges the register-client detour. A browser refresh
  // resets the workflow because the rest of the form cannot be restored safely.
  useEffect(() => {
    if (hasRunInitialRestoreRef.current) return
    hasRunInitialRestoreRef.current = true

    const restoreFile = async () => {
      try {
        const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        const loadedUrl = navigationEntry ? new URL(navigationEntry.name) : null
        const currentUrl = new URL(window.location.href)
        const isBrowserReload = Boolean(
          navigationEntry?.type === 'reload' &&
          loadedUrl?.pathname === currentUrl.pathname &&
          loadedUrl.search === currentUrl.search,
        )
        const isRegistrationReturn = currentStep === 'client' && Boolean(clientId)

        if (currentStep === 'upload' || isBrowserReload || !isRegistrationReturn) {
          clearFileStorage()

          if (currentStep !== 'upload') {
            await setCurrentStep('upload', { history: 'replace' })
            toast.info('Please upload the report and verify each step again.', {
              id: 'instant-test-refresh-reset',
            })
          }

          return
        }

        const currentFile = form.state.values.upload.file
        const file = currentFile || (hasStoredFile() ? await getFileFromStorage() : null)

        if (!file) {
          return
        }

        if (!currentFile) {
          form.setFieldValue('upload.file', file)
          toast.success('Uploaded file restored')
        }

        const queryKey = extractPdfQueryKey(file, 'instant-test')
        await prefetchExtractPdf(queryClient, file, 'instant-test')
        const extractedData = queryClient.getQueryData<ExtractedPdfData>(queryKey)
        if (extractedData) {
          hydrateExtractedData(extractedData)
        }
      } catch (error) {
        console.error('Failed to restore the uploaded instant-test report:', error)
        clearFileStorage()
        await setCurrentStep('upload', { history: 'replace' })
        toast.error('The report could not be restored. Please upload it again.', {
          id: 'instant-test-restore-failed',
        })
      } finally {
        setIsRestoringFile(false)
      }
    }

    restoreFile()
  }, [clientId, currentStep, form, hydrateExtractedData, queryClient, setCurrentStep])

  // Keep the uploaded PDF available if the user detours to client registration.
  useEffect(() => {
    if (uploadedFile && currentStep === 'client') {
      void saveFileToStorage(uploadedFile)
    }
  }, [currentStep, uploadedFile])

  // Guard against skipping into a later step without required base data
  useEffect(() => {
    if (isRestoringFile) {
      return
    }

    if (currentStep !== 'upload' && !uploadedFile) {
      setCurrentStep('upload', { history: 'replace' })
      toast.info('Please start from the beginning')
    }
  }, [currentStep, isRestoringFile, setCurrentStep, uploadedFile])

  // Handle client pre-population from scheduled collection or registration workflow.
  useEffect(() => {
    if (form.state.values.client.id) return
    if (!clientId && !bookingId) return

    const fetchAndPopulateClient = async () => {
      try {
        const client = clientId
          ? await getClientById(clientId)
          : bookingId
            ? await getClientByBookingId(bookingId)
            : null
        if (client && hydratedClientIdRef.current !== client.id) {
          form.setFieldValue('client.id', client.id)
          form.setFieldValue('client.firstName', client.firstName)
          form.setFieldValue('client.lastName', client.lastName)
          form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
          form.setFieldValue('client.email', client.email)
          form.setFieldValue('client.dob', client.dob ?? null)
          form.setFieldValue('client.headshot', client.headshot ?? null)
          form.setFieldValue('client.headshotId', client.headshotId ?? null)

          hydratedClientIdRef.current = client.id
          if (!bookingId) {
            toast.success(`Client ${client.firstName} ${client.lastName} pre-selected`, {
              id: `instant-test-client-${client.id}`,
            })
          }

          if (clientId && !bookingId) {
            setClientId(null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch client:', error)
        toast.error('Failed to load client information')
        if (clientId && !bookingId) {
          setClientId(null)
        }
      }
    }

    fetchAndPopulateClient()
  }, [bookingId, clientId, form, setClientId])

  if (completedTestId) {
    return (
      <TestCompleted
        testId={completedTestId}
        onBack={() => {
          if (bookingId) {
            clearFileStorage()
            router.push('/admin/drug-test-upload?workflow=guided&step=schedule')
            return
          }
          handleBack()
        }}
        backLabel={bookingId ? "Back to Today's Schedule" : undefined}
      />
    )
  }

  const currentStepIndex = steps.indexOf(currentStep)
  const isLastStep = currentStepIndex === steps.length - 1

  const handleGroupSubmit = async () => {
    if (!isLastStep) {
      const nextStep = steps[currentStepIndex + 1]
      if (currentStep === 'extract') {
        const queryKey = extractPdfQueryKey(form.state.values.upload.file, 'instant-test')
        const extractedData = queryClient.getQueryData<ExtractedPdfData>(queryKey)

        if (extractedData?.testType === '15-panel-instant') {
          toast.error('15-panel instant tests are no longer supported. Upload a 17-panel instant report.', {
            id: 'instant-test-unsupported-15-panel',
          })
          return
        }
      }

      if (currentStep === 'extract' && form.state.values.client.id) {
        const queryKey = extractPdfQueryKey(form.state.values.upload.file, 'instant-test')
        const extractedData = queryClient.getQueryData<ExtractedPdfData>(queryKey)
        const reportClientMatch = getReportClientMatch(extractedData?.donorName, form.state.values.client)
        const mismatchKey = getReportClientMismatchKey(reportClientMatch)

        if (
          reportClientMatch.status === 'mismatch' &&
          (!form.state.values.extract.clientMismatchConfirmed ||
            form.state.values.extract.clientMismatchConfirmationKey !== mismatchKey)
        ) {
          toast.error('Confirm the report/client mismatch before continuing.', {
            id: 'instant-test-report-client-mismatch',
          })
          return
        }
      }

      const shouldSkipClientStep = Boolean(bookingId && nextStep === 'client' && form.state.values.client.id)
      await setCurrentStep(shouldSkipClientStep ? 'medications' : nextStep, { history: 'push' })
      return
    }

    await form.handleSubmit()
  }

  const handleGroupSubmitInvalid = (_error?: unknown) => {
    focusFirstInvalidFieldWithToast(formRef.current, 'instant-test-step-invalid')
  }

  const renderStep = () => {
    const renderGroup = (
      name: 'upload' | 'extract' | 'client' | 'medications' | 'verifyData' | 'emails',
      validators: Parameters<typeof form.FormGroup>[0]['validators'],
      content: ReactNode,
    ) => (
      <form.FormGroup
        key={currentStep}
        name={name}
        validationLogic={revalidateLogic()}
        validators={validators}
        onGroupSubmit={handleGroupSubmit}
        onGroupSubmitInvalid={({ groupApi }) => handleGroupSubmitInvalid(groupApi.state.meta.errors)}
      >
        {(group) => (
          <>
            <div className="wizard-content mb-8 flex-1">{content}</div>
            <InstantTestNavigation form={form} group={group} onBack={handleBack} />
          </>
        )}
      </form.FormGroup>
    )

    switch (currentStep) {
      case 'upload':
        return renderGroup('upload', { onDynamic: uploadSchema.shape.upload }, <UploadStep form={form} />)
      case 'extract':
        return renderGroup('extract', { onDynamic: extractSchema.shape.extract }, <ExtractStep form={form} />)
      case 'client':
        return renderGroup('client', { onDynamic: clientSchema.shape.client }, <ClientStep form={form} />)
      case 'medications':
        return renderGroup(
          'medications',
          { onDynamic: medicationsSchema.shape.medications },
          <MedicationsStep form={form} />,
        )
      case 'verifyData':
        return renderGroup(
          'verifyData',
          { onDynamic: verifyDataSchema.shape.verifyData },
          <VerifyDataStep form={form} />,
        )
      case 'confirm':
        return renderGroup('verifyData', undefined, <ConfirmStep form={form} />)
      case 'reviewEmails':
        return renderGroup('emails', { onDynamic: emailsGroupSchema }, <EmailsStep form={form} />)
      default:
        return renderGroup('upload', { onDynamic: uploadSchema.shape.upload }, <UploadStep form={form} />)
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
      }}
      className="flex flex-1 flex-col"
    >
      {renderStep()}
    </form>
  )
}

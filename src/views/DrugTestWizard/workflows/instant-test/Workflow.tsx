'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral, parseAsString } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { getInstantTestFormOpts } from './shared-form'
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
import { steps } from './validators'
import { extractPdfQueryKey } from '../../queries'
import { getClientById } from '../components/client/getClients'
import { getFileFromStorage, clearFileStorage, hasStoredFile } from './utils/fileStorage'
import { safeServerAction } from '@/lib/actions/safeServerAction'

interface InstantTestWorkflowProps {
  onBack: () => void
}

export function InstantTestWorkflow({ onBack }: InstantTestWorkflowProps) {
  const queryClient = useQueryClient()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  // Wrap onBack to clear storage when navigating away
  const handleBack = () => {
    clearFileStorage()
    onBack()
  }

  // URL is single source of truth
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('upload'),
  )
  const currentStep = currentStepRaw as (typeof steps)[number]

  // Manage clientId param for pre-populating from registration workflow
  const [clientId, setClientId] = useQueryState('clientId', parseAsString)

  // Track previous step for navigation direction
  const prevStepRef = useRef(currentStep)

  const form = useAppForm({
    ...getInstantTestFormOpts(currentStep),
    onSubmit: async ({ value }) => {
      const currentStepIndex = steps.indexOf(currentStep)
      const isLastStep = currentStepIndex === steps.length - 1
      console.log(`[InstantTest] onSubmit called - step: ${currentStep}, isLastStep: ${isLastStep}`)

      if (!isLastStep) {
        // Navigate to next step
        await setCurrentStep(steps[currentStepIndex + 1], { history: 'push' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Final submit: Create drug test
      console.log(`[InstantTest] Starting final submission...`)
      try {
        const queryKey = extractPdfQueryKey(value.upload.file, '15-panel-instant')
        const extractedData = queryClient.getQueryData<any>(queryKey)
        console.log(`[InstantTest] Extracted data from query cache:`, extractedData ? 'found' : 'not found')

        // Convert File to buffer array
        console.log(`[InstantTest] Converting file to array buffer...`)
        const arrayBuffer = await value.upload.file.arrayBuffer()
        const pdfBuffer = Array.from(new Uint8Array(arrayBuffer))
        console.log(`[InstantTest] Buffer conversion complete`)

        // Log payload sizes for debugging
        const originalSizeMB = (value.upload.file.size / 1024 / 1024).toFixed(2)
        const bufferSizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2)
        const jsonSizeMB = (JSON.stringify(pdfBuffer).length / 1024 / 1024).toFixed(2)
        console.log(`[InstantTest] PDF Sizes - Original: ${originalSizeMB}MB, Buffer: ${bufferSizeMB}MB, JSON: ${jsonSizeMB}MB`)

        console.log(`[InstantTest] Calling createInstantTest server action...`)

        const result = await safeServerAction(() =>
          createInstantTest(
            {
              clientId: value.client.id,
              testType: value.verifyData.testType,
              collectionDate: value.verifyData.collectionDate,
              detectedSubstances: value.verifyData.detectedSubstances as any,
              isDilute: value.verifyData.isDilute,
              breathalyzerTaken: value.verifyData.breathalyzerTaken,
              breathalyzerResult: value.verifyData.breathalyzerResult ?? null,
              pdfBuffer,
              pdfFilename: value.upload.file.name,
              hasConfirmation: extractedData?.hasConfirmation,
              confirmationResults: extractedData?.confirmationResults,
              confirmationDecision: value.verifyData.confirmationDecision ?? null,
              confirmationSubstances: value.verifyData.confirmationSubstances as any,
            },
            value.medications,
            {
              clientEmailEnabled: value.emails.clientEmailEnabled,
              clientRecipients: value.emails.clientEmailEnabled ? value.emails.clientRecipients : [],
              referralEmailEnabled: value.emails.referralEmailEnabled,
              referralRecipients: value.emails.referralRecipients,
            },
          ),
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

  // Restore file from localStorage on mount (e.g., after returning from registration)
  useEffect(() => {
    const restoreFile = async () => {
      if (hasStoredFile() && !form.state.values.upload.file) {
        const file = await getFileFromStorage()
        if (file) {
          form.setFieldValue('upload.file', file)
          toast.success('Uploaded file restored')
        }
      }
    }

    restoreFile()
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle validation on backward navigation
  useEffect(() => {
    const currentIndex = steps.indexOf(currentStep)
    const prevIndex = steps.indexOf(prevStepRef.current)

    // Validate when going backward
    if (currentIndex < prevIndex) {
      form.validate('submit')
    }

    // Guard: prevent skipping to advanced steps
    if (currentStep !== 'upload' && !form.state.values.upload.file) {
      setCurrentStep('upload', { history: 'replace' })
      toast.info('Please start from the beginning')
    }

    prevStepRef.current = currentStep
  }, [currentStep, form, setCurrentStep])

  // Handle client pre-population from registration workflow
  useEffect(() => {
    if (clientId && currentStep === 'client' && !form.state.values.client.id) {
      // Fetch client by ID and populate form
      const fetchAndPopulateClient = async () => {
        try {
          const client = await getClientById(clientId)
          if (client) {
            form.setFieldValue('client.id', client.id)
            form.setFieldValue('client.firstName', client.firstName)
            form.setFieldValue('client.lastName', client.lastName)
            form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
            form.setFieldValue('client.email', client.email)
            form.setFieldValue('client.dob', client.dob ?? null)
            form.setFieldValue('client.headshot', client.headshot ?? null)

            toast.success(`Client ${client.firstName} ${client.lastName} pre-selected`)

            // Clear the clientId param after population
            setClientId(null)

            // Clear stored file after successful restoration of both file and client
            clearFileStorage()
          }
        } catch (error) {
          console.error('Failed to fetch client:', error)
          toast.error('Failed to load client information')
          // Clear the clientId param on error
          setClientId(null)
        }
      }

      fetchAndPopulateClient()
    }
  }, [clientId, currentStep, form, setClientId])

  if (completedTestId) {
    return <TestCompleted testId={completedTestId} onBack={handleBack} />
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'upload':
        return <UploadStep form={form} />
      case 'extract':
        return <ExtractStep form={form} />
      case 'client':
        return <ClientStep form={form} />
      case 'medications':
        return <MedicationsStep form={form} />
      case 'verifyData':
        return <VerifyDataStep form={form} />
      case 'confirm':
        return <ConfirmStep form={form} />
      case 'reviewEmails':
        return <EmailsStep form={form} />
      default:
        return <UploadStep form={form} />
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-1 flex-col"
    >
      <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
      <InstantTestNavigation form={form} onBack={handleBack} />
    </form>
  )
}

'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Stepper, type Step } from '@/components/ui/stepper'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useFormStepper } from '@/app/(frontend)/register/hooks/useFormStepper'
import { z } from 'zod'
import { UploadFieldGroup, uploadFieldSchema } from '../field-groups/UploadFieldGroup'
import { ExtractFieldGroup, extractFieldSchema } from '../field-groups/ExtractFieldGroup'
import { VerifyTestFieldGroup, verifyTestFieldSchema } from '../field-groups/VerifyTestFieldGroup'
import { VerifyDataFieldGroup, verifyDataFieldSchema } from '../field-groups/VerifyDataFieldGroup'
import { TestSummaryFieldGroup, testSummaryFieldSchema } from '../field-groups/TestSummary'
import { ReviewEmailsFieldGroup, reviewEmailsFieldSchema } from '../field-groups/ReviewEmailsFieldGroup'
import { updateTestWithScreening } from '../actions'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { generateTestFilename } from '../utils/generateFilename'
import { extractPdfQueryKey, type ExtractedPdfData } from '../queries'
import { wizardWrapperStyles } from '../styles'
import { WizardHeader } from '../components/main-wizard/WizardHeader'
import { WizardType } from '../types'
import { TestCompleted } from '../components/TestCompleted'

// Step schemas
const uploadSchema = z.object({
  uploadData: uploadFieldSchema,
})

const extractSchema = z.object({
  extractData: extractFieldSchema,
})

const verifyTestSchema = z.object({
  verifyTest: verifyTestFieldSchema,
})

const verifyDataSchema = z.object({
  verifyData: verifyDataFieldSchema,
})

const testSummarySchema = z.object({
  testSummary: testSummaryFieldSchema,
})

const reviewEmailsSchema = z.object({
  reviewEmailsData: reviewEmailsFieldSchema,
})

const stepSchemas = [
  uploadSchema,
  extractSchema,
  verifyTestSchema,
  verifyDataSchema,
  testSummarySchema,
  reviewEmailsSchema,
]

// Complete form schema
const completeEnterLabScreenSchema = z.object({
  uploadData: uploadFieldSchema,
  extractData: extractFieldSchema,
  verifyTest: verifyTestFieldSchema,
  verifyData: verifyDataFieldSchema,
  testSummary: testSummaryFieldSchema,
  reviewEmailsData: reviewEmailsFieldSchema,
})

type EnterLabScreenFormType = z.infer<typeof completeEnterLabScreenSchema>

interface EnterLabScreenWorkflowProps {
  onBack: () => void
}

export function EnterLabScreenWorkflow({ onBack }: EnterLabScreenWorkflowProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  const handleComplete = (testId: string) => {
    setCompletedTestId(testId)
  }

  // Get extracted data from query cache - called during form submission
  const getExtractData = useCallback(
    (file: File, wizardType: WizardType) => {
      const queryKey = extractPdfQueryKey(file, wizardType)
      return queryClient.getQueryData<ExtractedPdfData>(queryKey)
    },
    [queryClient],
  )

  const formOpts = {
    defaultValues: {
      uploadData: {
        file: null as any,
        fileUrl: '',
        fileName: '',
        wizardType: 'enter-lab-screen' as const,
      },
      extractData: {
        // Minimal schema - actual data lives in TanStack Query cache
        extracted: false,
      },
      verifyTest: {
        testId: '',
        clientName: '',
        testType: '',
        collectionDate: '',
        screeningStatus: '',
        matchType: 'manual' as const,
        score: 0,
      },
      verifyData: {
        testType: '11-panel-lab' as const,
        collectionDate: '',
        detectedSubstances: [],
        isDilute: false,
        breathalyzerTaken: false,
        breathalyzerResult: null,
        confirmationDecision: null,
        confirmationSubstances: [],
      },
      testSummary: {
        previewComputed: false,
      },
      reviewEmailsData: {
        clientEmailEnabled: true,
        clientRecipients: [],
        referralEmailEnabled: true,
        referralRecipients: [],
        previewsLoaded: false,
      },
    },
    onSubmit: async ({ value }: { value: EnterLabScreenFormType }) => {
      try {
        const file = value.uploadData.file
        if (!file) {
          throw new Error('No file selected')
        }

        const buffer = await file.arrayBuffer()
        const pdfBuffer = Array.from(new Uint8Array(buffer))

        // Get extracted data from query cache for email-building fields
        const extractData = getExtractData(file, value.uploadData.wizardType)

        const confirmationResults = (extractData?.confirmationResults || []).map((r) => ({
          substance: r.substance as SubstanceValue,
          result: r.result,
          notes: r.notes,
        }))

        // Generate formatted filename using utility function
        // Note: client is null for lab workflows since we match existing tests
        // Will fall back to original filename
        const pdfFilename = generateTestFilename({
          client: null,
          collectionDate: value.verifyData.collectionDate,
          testType: value.verifyData.testType,
          isConfirmation: false,
        })

        const result = await updateTestWithScreening({
          testId: value.verifyTest.testId,
          detectedSubstances: value.verifyData.detectedSubstances as any,
          isDilute: value.verifyData.isDilute,
          pdfBuffer,
          pdfFilename: pdfFilename || file.name, // Fallback to original filename if generation fails
          hasConfirmation: extractData?.hasConfirmation,
          confirmationResults,
          confirmationDecision: value.verifyData.confirmationDecision,
          confirmationSubstances: value.verifyData.confirmationSubstances as SubstanceValue[],
        })

        if (result.success) {
          handleComplete(value.verifyTest.testId)
        } else {
          throw new Error(result.error || 'Failed to update test')
        }
      } catch (error: any) {
        console.error('Error updating test:', error)
        throw error
      }
    },
  }

  const form = useAppForm({ ...formOpts })

  const { currentStep, isLastStep, handleNextStepOrSubmit, handleCancelOrBack, setCurrentStep } =
    useFormStepper(stepSchemas)

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const handleNext = async () => {
    await handleNextStepOrSubmit(form)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrevious = () => {
    if (currentStep === 1) {
      onBack()
    } else {
      handleCancelOrBack({
        onBack: () => {},
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleStepClick = (stepId: string) => {
    const stepIndex = steps.findIndex((s) => s.id === stepId)
    if (stepIndex !== -1 && stepIndex < currentStep - 1) {
      setCurrentStep(stepIndex + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const steps: Step[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'extract', label: 'Extract' },
    { id: 'verify-test', label: 'Match' },
    { id: 'verify-data', label: 'Verify' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'review-emails', label: 'Emails' },
  ]

  const stepMapping: Record<number, string> = {
    1: 'upload',
    2: 'extract',
    3: 'verify-test',
    4: 'verify-data',
    5: 'confirm',
    6: 'review-emails',
  }

  const currentStepId = stepMapping[currentStep]

  // Show completion screen if test was updated successfully
  if (completedTestId) {
    return <TestCompleted testId={completedTestId} onBack={onBack} />
  }
  return (
    <>
      <div className={wizardWrapperStyles.header}>
        <WizardHeader
          title="Enter Lab Screening Results"
          description="Upload and process laboratory screening results"
        />
      </div>

      <div className={wizardWrapperStyles.stepper}>
        <Stepper steps={steps} currentStepId={currentStepId} onStepClick={handleStepClick} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className="flex flex-1 flex-col"
      >
        <div className="wizard-content mb-8 flex-1">
          {currentStep === 1 && (
            <UploadFieldGroup form={form} fields="uploadData" title="Upload Lab Report" description="" />
          )}

          {currentStep === 2 && <ExtractFieldGroup form={form} fields="extractData" title="Extract Data" />}

          {currentStep === 3 && (
            <VerifyTestFieldGroup
              form={form}
              fields="verifyTest"
              title="Match Pending Test"
              description="Select the pending test that matches this lab report"
              filterStatus={['collected']}
            />
          )}

          {currentStep === 4 && (
            <VerifyDataFieldGroup form={form} fields="verifyData" title="Verify Screening Results" description="" />
          )}

          {currentStep === 5 && (
            <TestSummaryFieldGroup form={form} fields="testSummary" title="Confirm Update" description="" />
          )}

          {currentStep === 6 && (
            <ReviewEmailsFieldGroup
              form={form}
              fields="reviewEmailsData"
              title="Review Emails"
              description=""
              workflowMode="screening"
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            type="button"
            onClick={handlePrevious}
            variant="outline"
            disabled={isSubmitting}
            size="lg"
            className="text-lg"
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {!isLastStep ? (
            <Button type="button" onClick={handleNext} size="lg" className="text-lg">
              Next
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              className={`bg-secondary text-secondary-foreground hover:bg-secondary/90 ${
                isSubmitting ? 'cursor-not-allowed opacity-50' : ''
              }`}
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting ? (
                'Updating...'
              ) : (
                <>
                  Update Drug Test
                  <Check className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </>
  )
}

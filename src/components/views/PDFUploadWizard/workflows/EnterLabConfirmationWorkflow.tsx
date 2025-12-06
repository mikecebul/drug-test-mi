'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stepper, type Step } from '@/components/ui/stepper'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useFormStepper } from '@/app/(frontend)/register/hooks/useFormStepper'
import { z } from 'zod'
import { UploadFieldGroup, uploadFieldSchema } from '../field-groups/UploadFieldGroup'
import { ExtractFieldGroup, extractFieldSchema } from '../field-groups/ExtractFieldGroup'
import { VerifyTestFieldGroup, verifyTestFieldSchema } from '../field-groups/VerifyTestFieldGroup'
import {
  VerifyConfirmationFieldGroup,
  verifyConfirmationFieldSchema,
} from '../field-groups/VerifyConfirmationFieldGroup'
import {
  ConfirmConfirmationFieldGroup,
  confirmConfirmationFieldSchema,
} from '../field-groups/ConfirmConfirmationFieldGroup'
import {
  ReviewEmailsFieldGroup,
  reviewEmailsFieldSchema,
} from '../field-groups/ReviewEmailsFieldGroup'
import { updateTestWithConfirmation } from '../actions'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { generateTestFilename } from '../utils/generateFilename'

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

const verifyConfirmationSchema = z.object({
  verifyConfirmation: verifyConfirmationFieldSchema,
})

const confirmSchema = z.object({
  confirmData: confirmConfirmationFieldSchema,
})

const reviewEmailsSchema = z.object({
  reviewEmailsData: reviewEmailsFieldSchema,
})

const stepSchemas = [
  uploadSchema,
  extractSchema,
  verifyTestSchema,
  verifyConfirmationSchema,
  confirmSchema,
  reviewEmailsSchema,
]

// Complete form schema
const completeEnterLabConfirmationSchema = z.object({
  uploadData: uploadFieldSchema,
  extractData: extractFieldSchema,
  verifyTest: verifyTestFieldSchema,
  verifyConfirmation: verifyConfirmationFieldSchema,
  confirmData: confirmConfirmationFieldSchema,
  reviewEmailsData: reviewEmailsFieldSchema,
})

type EnterLabConfirmationFormType = z.infer<typeof completeEnterLabConfirmationSchema>

interface EnterLabConfirmationWorkflowProps {
  onBack: () => void
}

export function EnterLabConfirmationWorkflow({ onBack }: EnterLabConfirmationWorkflowProps) {
  const router = useRouter()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  const handleComplete = (testId: string) => {
    setCompletedTestId(testId)
  }

  const formOpts = {
    defaultValues: {
      uploadData: {
        file: null as any,
        fileUrl: '',
        fileName: '',
        testType: '11-panel-lab' as const,
      },
      extractData: {
        extracting: false,
        extracted: false,
        donorName: null,
        collectionDate: null,
        detectedSubstances: [],
        isDilute: false,
        rawText: '',
        confidence: 'low' as const,
        extractedFields: [],
        testType: '11-panel-lab' as const,
        hasConfirmation: false,
        confirmationResults: [],
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
      verifyConfirmation: {
        confirmationResults: [],
        clientData: null,
        detectedSubstances: [],
        isDilute: false,
      },
      confirmData: {
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
    onSubmit: async ({ value }: { value: EnterLabConfirmationFormType }) => {
      try {
        const file = value.uploadData.file
        if (!file) {
          throw new Error('No file selected')
        }

        const buffer = await file.arrayBuffer()
        const pdfBuffer = Array.from(new Uint8Array(buffer))

        const confirmationResults = value.verifyConfirmation.confirmationResults.map((r) => ({
          substance: r.substance as SubstanceValue,
          result: r.result,
        }))

        // Generate formatted filename using utility function
        const pdfFilename = generateTestFilename({
          client: value.verifyConfirmation.clientData,
          collectionDate: value.verifyTest.collectionDate,
          testType: value.verifyTest.testType,
          isConfirmation: true,
        })

        const result = await updateTestWithConfirmation({
          testId: value.verifyTest.testId,
          pdfBuffer,
          pdfFilename: pdfFilename || file.name, // Fallback to original filename if generation fails
          confirmationResults,
        })

        if (result.success) {
          handleComplete(value.verifyTest.testId)
        } else {
          throw new Error(result.error || 'Failed to update confirmation')
        }
      } catch (error: any) {
        console.error('Error updating confirmation:', error)
        throw error
      }
    },
  }

  const form = useAppForm(formOpts)

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
    { id: 'verify-confirmation', label: 'Verify' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'review-emails', label: 'Emails' },
  ]

  const stepMapping: Record<number, string> = {
    1: 'upload',
    2: 'extract',
    3: 'verify-test',
    4: 'verify-confirmation',
    5: 'confirm',
    6: 'review-emails',
  }

  const currentStepId = stepMapping[currentStep]

  // Show completion screen if confirmation was updated successfully
  if (completedTestId) {
    return (
      <ShadcnWrapper className="mx-auto my-32 flex max-w-sm origin-top scale-125 flex-col items-center md:max-w-2xl lg:mx-auto lg:max-w-4xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            Lab Confirmation Results Uploaded Successfully!
          </h1>
          <p className="text-muted-foreground">
            The confirmation results have been added and notification emails have been sent.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onBack} size="lg">
            Start New Workflow
          </Button>
          <Button
            onClick={() => router.push(`/admin/collections/drug-tests/${completedTestId}`)}
            variant="outline"
            size="lg"
          >
            View Drug Test
          </Button>
        </div>
      </ShadcnWrapper>
    )
  }

  return (
    <ShadcnWrapper className="mx-auto flex max-w-sm origin-top scale-125 flex-col pb-8 md:max-w-2xl lg:mx-auto lg:max-w-4xl">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Enter Lab Confirmation Results</h1>
        <p className="text-muted-foreground">Upload and process laboratory confirmation results</p>
      </div>

      <div className="mb-8">
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
            <UploadFieldGroup
              form={form}
              fields="uploadData"
              title="Upload Confirmation Report"
              description=""
            />
          )}

          {currentStep === 2 && (
            <ExtractFieldGroup form={form} fields="extractData" title="Extract Confirmation Data" />
          )}

          {currentStep === 3 && (
            <VerifyTestFieldGroup
              form={form}
              fields="verifyTest"
              title="Match Test for Confirmation"
              description="Select the test that needs confirmation results"
              filterStatus={['screened', 'confirmation-pending']}
            />
          )}

          {currentStep === 4 && (
            <VerifyConfirmationFieldGroup
              form={form}
              fields="verifyConfirmation"
              title="Verify Confirmation Results"
              description="Review and adjust the confirmation results extracted from the PDF"
            />
          )}

          {currentStep === 5 && (
            <ConfirmConfirmationFieldGroup
              form={form}
              fields="confirmData"
              title="Confirm Confirmation Update"
              description=""
            />
          )}

          {currentStep === 6 && (
            <ReviewEmailsFieldGroup
              form={form}
              fields="reviewEmailsData"
              title="Review Emails"
              description=""
              workflowMode="confirmation"
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button type="button" onClick={handlePrevious} variant="outline" disabled={isSubmitting}>
            <ChevronLeft className="mr-2 h-5 w-5" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {!isLastStep ? (
            <Button type="button" onClick={handleNext}>
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
            >
              {isSubmitting ? (
                'Updating...'
              ) : (
                <>
                  Update Confirmation
                  <Check className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </ShadcnWrapper>
  )
}

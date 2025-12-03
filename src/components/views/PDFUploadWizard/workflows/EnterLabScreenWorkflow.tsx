'use client'

import React from 'react'
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
import { VerifyDataFieldGroup, verifyDataFieldSchema } from '../field-groups/VerifyDataFieldGroup'
import { ConfirmFieldGroup, confirmFieldSchema } from '../field-groups/ConfirmFieldGroup'
import { ReviewEmailsFieldGroup, reviewEmailsFieldSchema } from '../field-groups/ReviewEmailsFieldGroup'
import { updateTestWithScreening } from '../actions'
import type { SubstanceValue } from '@/fields/substanceOptions'

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

const confirmSchema = z.object({
  confirmData: confirmFieldSchema,
})

const reviewEmailsSchema = z.object({
  reviewEmailsData: reviewEmailsFieldSchema,
})

const stepSchemas = [
  uploadSchema,
  extractSchema,
  verifyTestSchema,
  verifyDataSchema,
  confirmSchema,
  reviewEmailsSchema,
]

// Complete form schema
const completeEnterLabScreenSchema = z.object({
  uploadData: uploadFieldSchema,
  extractData: extractFieldSchema,
  verifyTest: verifyTestFieldSchema,
  verifyData: verifyDataFieldSchema,
  confirmData: confirmFieldSchema,
  reviewEmailsData: reviewEmailsFieldSchema,
})

type EnterLabScreenFormType = z.infer<typeof completeEnterLabScreenSchema>

interface EnterLabScreenWorkflowProps {
  onBack: () => void
}

export function EnterLabScreenWorkflow({ onBack }: EnterLabScreenWorkflowProps) {
  const router = useRouter()

  const handleComplete = (testId: string) => {
    router.push(`/admin/collections/drug-tests/${testId}`)
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
      verifyData: {
        testType: '11-panel-lab' as const,
        collectionDate: '',
        detectedSubstances: [],
        isDilute: false,
        clientData: null,
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
    onSubmit: async ({ value }: { value: EnterLabScreenFormType }) => {
      try {
        const file = value.uploadData.file
        if (!file) {
          throw new Error('No file selected')
        }

        const buffer = await file.arrayBuffer()
        const pdfBuffer = Array.from(new Uint8Array(buffer))

        const confirmationResults = (value.extractData.confirmationResults || []).map((r) => ({
          substance: r.substance as SubstanceValue,
          result: r.result,
          notes: r.notes,
        }))

        const result = await updateTestWithScreening({
          testId: value.verifyTest.testId,
          detectedSubstances: value.verifyData.detectedSubstances as any,
          isDilute: value.verifyData.isDilute,
          pdfBuffer,
          pdfFilename: file.name,
          hasConfirmation: value.extractData.hasConfirmation,
          confirmationResults,
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

  const form = useAppForm(formOpts)

  const {
    currentStep,
    isLastStep,
    handleNextStepOrSubmit,
    handleCancelOrBack,
    setCurrentStep,
  } = useFormStepper(stepSchemas)

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

  return (
    <ShadcnWrapper className="mx-auto my-32 flex max-w-sm scale-125 flex-col md:max-w-2xl lg:mx-auto lg:max-w-4xl">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Enter Lab Screening Results</h1>
        <p className="text-muted-foreground">
          Upload and process laboratory screening results
        </p>
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
              title="Upload Lab Report"
              description=""
            />
          )}

          {currentStep === 2 && (
            <ExtractFieldGroup form={form} fields="extractData" title="Extract Data" />
          )}

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
            <VerifyDataFieldGroup
              form={form}
              fields="verifyData"
              title="Verify Screening Results"
              description=""
            />
          )}

          {currentStep === 5 && (
            <ConfirmFieldGroup
              form={form}
              fields="confirmData"
              title="Confirm Update"
              description=""
            />
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
          >
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
                  Update Drug Test
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

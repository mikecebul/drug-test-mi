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
import { SelectTestFieldGroup, selectTestFieldSchema } from '../field-groups/SelectTestFieldGroup'
import { UploadFieldGroup, uploadFieldSchema } from '../field-groups/UploadFieldGroup'
import { ExtractFieldGroup, extractFieldSchema } from '../field-groups/ExtractFieldGroup'
import { ConfirmFieldGroup, confirmFieldSchema } from '../field-groups/ConfirmFieldGroup'
import { updateTestWithConfirmation } from '../actions'
import type { SubstanceValue } from '@/fields/substanceOptions'

// Step schemas
const selectTestSchema = z.object({
  selectTest: selectTestFieldSchema,
})

const uploadSchema = z.object({
  uploadData: uploadFieldSchema,
})

const extractSchema = z.object({
  extractData: extractFieldSchema,
})

const confirmSchema = z.object({
  confirmData: confirmFieldSchema,
})

const stepSchemas = [selectTestSchema, uploadSchema, extractSchema, confirmSchema]

// Complete form schema
const completeEnterLabConfirmationSchema = z.object({
  selectTest: selectTestFieldSchema,
  uploadData: uploadFieldSchema,
  extractData: extractFieldSchema,
  confirmData: confirmFieldSchema,
})

type EnterLabConfirmationFormType = z.infer<typeof completeEnterLabConfirmationSchema>

interface EnterLabConfirmationWorkflowProps {
  onBack: () => void
}

export function EnterLabConfirmationWorkflow({ onBack }: EnterLabConfirmationWorkflowProps) {
  const router = useRouter()

  const handleComplete = (testId: string) => {
    router.push(`/admin/collections/drug-tests/${testId}`)
  }

  const formOpts = {
    defaultValues: {
      selectTest: {
        testId: '',
        clientName: '',
        testType: '',
        collectionDate: '',
        screeningStatus: '',
      },
      uploadData: {
        file: null as any, // Will be set when user uploads
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
        hasConfirmation: false,
        confirmationResults: [],
      },
      confirmData: {
        previewComputed: false,
      },
    },
    onSubmit: async ({ value }: { value: EnterLabConfirmationFormType }) => {
      try {
        // Get PDF buffer from file
        const file = value.uploadData.file
        if (!file) {
          throw new Error('No file selected')
        }

        const buffer = await file.arrayBuffer()
        const pdfBuffer = Array.from(new Uint8Array(buffer))

        // Update the existing test with confirmation results only
        // Confirmation results come from extractData, not confirmData
        const confirmationResults = (value.extractData.confirmationResults || []).map((r) => ({
          substance: r.substance as SubstanceValue,
          result: r.result,
          notes: r.notes,
        }))

        const result = await updateTestWithConfirmation({
          testId: value.selectTest.testId,
          pdfBuffer,
          pdfFilename: file.name,
          confirmationResults,
        })

        if (result.success) {
          handleComplete(value.selectTest.testId)
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
    { id: 'select-test', label: 'Select' },
    { id: 'upload', label: 'Upload' },
    { id: 'extract', label: 'Extract' },
    { id: 'confirm', label: 'Confirm' },
  ]

  const stepMapping: Record<number, string> = {
    1: 'select-test',
    2: 'upload',
    3: 'extract',
    4: 'confirm',
  }

  const currentStepId = stepMapping[currentStep]

  return (
    <ShadcnWrapper className="mx-auto my-32 flex max-w-sm scale-125 flex-col md:max-w-2xl lg:mx-auto lg:max-w-4xl">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Enter Lab Confirmation Results</h1>
        <p className="text-muted-foreground">
          Upload and process laboratory confirmation results
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
            <SelectTestFieldGroup
              form={form}
              fields="selectTest"
              title="Select Test for Confirmation"
              description=""
              filterStatus={['screened', 'confirmation-pending']}
            />
          )}

          {currentStep === 2 && (
            <UploadFieldGroup
              form={form}
              fields="uploadData"
              title="Upload Confirmation Report"
              description=""
            />
          )}

          {currentStep === 3 && (
            <ExtractFieldGroup form={form} fields="extractData" title="Extract Confirmation Data" />
          )}

          {currentStep === 4 && (
            <ConfirmFieldGroup form={form} fields="confirmData" title="Confirm Update" description="" />
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

'use client'

import React, { useState } from 'react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { WizardTypeSelector } from './WizardTypeSelector'
import { CollectLabWorkflow } from './workflows/CollectLabWorkflow'
import { EnterLabScreenWorkflow } from './workflows/EnterLabScreenWorkflow'
import { EnterLabConfirmationWorkflow } from './workflows/EnterLabConfirmationWorkflow'
import type { WizardType } from './types'
import { useRouter } from 'next/navigation'
import { Stepper, type Step } from '@/components/ui/stepper'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { usePdfUploadFormOpts } from './use-pdf-upload-form-opts'
import { useFormStepper } from '@/app/(frontend)/register/hooks/useFormStepper'
import { stepSchemas } from './schemas/pdfUploadSchemas'
import { UploadFieldGroup } from './field-groups/UploadFieldGroup'
import { ExtractFieldGroup } from './field-groups/ExtractFieldGroup'
import { VerifyClientFieldGroup } from './field-groups/VerifyClientFieldGroup'
import { VerifyDataFieldGroup } from './field-groups/VerifyDataFieldGroup'
import { ConfirmFieldGroup } from './field-groups/ConfirmFieldGroup'
import { ReviewEmailsFieldGroup } from './field-groups/ReviewEmailsFieldGroup'

type WizardStep =
  | 'upload'
  | 'extract'
  | 'verify-client'
  | 'verify-data'
  | 'confirm'
  | 'review-emails'

export function PDFUploadWizardClient() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WizardType | null>(null)

  // Reset workflow selection
  const handleBack = () => {
    setSelectedWorkflow(null)
  }

  // Handle workflow type selection
  const handleWorkflowSelect = (wizardType: WizardType) => {
    setSelectedWorkflow(wizardType)
  }

  // Show workflow type selector if no workflow is selected
  if (!selectedWorkflow) {
    return (
      <ShadcnWrapper className="mx-auto my-32 flex max-w-sm origin-top scale-125 flex-col md:max-w-2xl lg:mx-auto lg:max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Drug Test Workflow</h1>
          <p className="text-muted-foreground">Select the type of workflow you want to perform</p>
        </div>
        <WizardTypeSelector onSelect={handleWorkflowSelect} />
      </ShadcnWrapper>
    )
  }

  // Route to appropriate workflow
  if (selectedWorkflow === 'collect-lab') {
    return <CollectLabWorkflow onBack={handleBack} />
  }

  if (selectedWorkflow === 'enter-lab-screen') {
    return <EnterLabScreenWorkflow onBack={handleBack} />
  }

  if (selectedWorkflow === 'enter-lab-confirmation') {
    return <EnterLabConfirmationWorkflow onBack={handleBack} />
  }

  // 15-panel instant workflow (existing workflow)
  return <InstantTestWorkflow onBack={handleBack} />
}

// 15-Panel Instant Test Workflow (existing workflow)
function InstantTestWorkflow({ onBack }: { onBack: () => void }) {
  const router = useRouter()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  const handleComplete = (testId: string) => {
    setCompletedTestId(testId)
  }

  const formOpts = usePdfUploadFormOpts({ onComplete: handleComplete })
  const form = useAppForm({ ...formOpts })

  const {
    currentStep,
    isFirstStep,
    isLastStep,
    handleNextStepOrSubmit,
    handleCancelOrBack,
    setCurrentStep,
  } = useFormStepper(stepSchemas)

  // Get form values for display
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
    { id: 'verify-client', label: 'Client' },
    { id: 'verify-data', label: 'Verify' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'review-emails', label: 'Emails' },
  ]

  const stepMapping: Record<number, WizardStep> = {
    1: 'upload',
    2: 'extract',
    3: 'verify-client',
    4: 'verify-data',
    5: 'confirm',
    6: 'review-emails',
  }

  const currentStepId = stepMapping[currentStep]

  // Step component mapping
  const stepComponents: Record<number, React.ReactNode> = {
    1: (
      <UploadFieldGroup
        form={form}
        fields="uploadData"
        title="Upload Drug Test PDF"
        description="Select a PDF file from your 15-panel instant test"
      />
    ),
    2: <ExtractFieldGroup form={form} fields="extractData" title="Extract Data" />,
    3: <VerifyClientFieldGroup form={form} fields="clientData" title="Verify Client" />,
    4: (
      <VerifyDataFieldGroup
        form={form}
        fields="verifyData"
        title="Verify Test Data"
        description="Review and adjust the extracted data before creating the test record"
      />
    ),
    5: (
      <ConfirmFieldGroup
        form={form}
        fields="confirmData"
        title="Confirm and Create"
        description="Review the final data before creating the drug test record"
      />
    ),
    6: (
      <ReviewEmailsFieldGroup
        form={form}
        fields="reviewEmailsData"
        title="Review Emails"
        description="Review and customize the emails that will be sent for this drug test"
        workflowMode="screening"
      />
    ),
  }

  // Show completion screen if test was created successfully
  if (completedTestId) {
    return (
      <ShadcnWrapper className="mx-auto my-32 flex max-w-sm origin-top scale-125 flex-col items-center md:max-w-2xl lg:mx-auto lg:max-w-4xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            Drug Test Created Successfully!
          </h1>
          <p className="text-muted-foreground">
            The drug test has been created and notification emails have been sent.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onBack} size="lg">
            Start New Test
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
    <ShadcnWrapper className="mx-auto my-32 flex max-w-sm origin-top scale-125 flex-col md:max-w-2xl lg:mx-auto lg:max-w-4xl">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Drug Test Upload Wizard</h1>
        <p className="text-muted-foreground">
          Upload and process drug test PDFs quickly and accurately
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
        <div className="wizard-content mb-8 flex-1">{stepComponents[currentStep]}</div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button type="button" onClick={handlePrevious} variant="outline">
            <ChevronLeft className="mr-2 h-5 w-5" />
            {isFirstStep ? 'Cancel' : 'Back'}
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
                'Creating...'
              ) : (
                <>
                  Create Drug Test
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

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Stepper, type Step } from '@/components/ui/stepper'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
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

type WizardStep = 'upload' | 'extract' | 'verify-client' | 'verify-data' | 'confirm' | 'review-emails'

export function PDFUploadWizardClient() {
  const router = useRouter()

  const handleComplete = (testId: string) => {
    // Redirect to the created drug test in admin panel
    router.push(`/admin/collections/drug-tests/${testId}`)
  }

  const formOpts = usePdfUploadFormOpts({ onComplete: handleComplete })
  const form = useAppForm({ ...formOpts })

  const {
    currentStep,
    isFirstStep,
    isLastStep,
    handleNextStepOrSubmit,
    handleCancelOrBack,
  } = useFormStepper(stepSchemas)

  // Get form values for display
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const handleNext = async () => {
    await handleNextStepOrSubmit(form)
  }

  const handlePrevious = () => {
    handleCancelOrBack({
      onBack: () => {},
    })
  }

  const steps: Step[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'extract', label: 'Extract' },
    { id: 'verify-client', label: 'Client' },
    { id: 'verify-data', label: 'Verify' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'review-emails', label: 'Review Emails' },
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
      />
    ),
  }

  return (
    <ShadcnWrapper className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Drug Test Upload Wizard</h1>
        <p className="text-muted-foreground">
          Upload and process drug test PDFs quickly and accurately
        </p>
      </div>

      <div className="mb-8">
        <Stepper steps={steps} currentStepId={currentStepId} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <div className="wizard-content mb-8">{stepComponents[currentStep]}</div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            type="button"
            onClick={handlePrevious}
            variant="outline"
            disabled={isFirstStep}
            className={isFirstStep ? 'cursor-not-allowed opacity-50' : ''}
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            Back
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

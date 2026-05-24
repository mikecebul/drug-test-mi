'use client'

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { getLabConfirmationFormOpts } from './shared-form'
import { LabConfirmationNavigation } from './components/Navigation'
import { UploadStep } from './steps/Upload'
import { ExtractStep } from './steps/Extract'
import { MatchCollectionStep } from './steps/MatchCollection'
import { LabConfirmationDataStep } from './steps/LabConfirmationData'
import { ConfirmStep } from './steps/confirm/Step'
import { EmailsStep } from './steps/Emails'
import { updateLabConfirmationWithEmailReview } from './actions/updateLabConfirmationWithEmailReview'
import { TestCompleted } from '../../components/TestCompleted'
import {
  emailsGroupSchema,
  extractSchema,
  labConfirmationDataSchema,
  matchCollectionSchema,
  steps,
  uploadSchema,
} from './validators'
import { extractPdfQueryKey } from '../../queries'
import type { ExtractedPdfData } from '../../queries'
import { focusFirstInvalidField, useStepFocus } from '@/lib/form-scroll-focus'

interface LabConfirmationWorkflowProps {
  onBack: () => void
}

export function LabConfirmationWorkflow({ onBack }: LabConfirmationWorkflowProps) {
  const queryClient = useQueryClient()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  // URL is single source of truth
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps).withDefault('upload'),
  )
  const currentStep = currentStepRaw
  const formRef = useRef<HTMLFormElement | null>(null)

  useStepFocus({
    containerRef: formRef,
    stepKey: currentStep,
  })

  const form = useAppForm({
    ...getLabConfirmationFormOpts(),
    onSubmit: async ({ value }) => {
      // Final submit: Update drug test with confirmation results and send emails
      try {
        const queryKey = extractPdfQueryKey(value.upload.file, 'enter-lab-confirmation')
        const extractedData = queryClient.getQueryData<ExtractedPdfData>(queryKey)

        const result = await updateLabConfirmationWithEmailReview(value, extractedData)

        if (result.success && result.testId) {
          setCompletedTestId(result.testId)
        } else {
          toast.error(result.error || 'Failed to update test with confirmation results')
        }
      } catch (error) {
        console.error('Unexpected error during submission:', error)
        toast.error('An unexpected error occurred. Please try again.')
      }
    },
  })

  // Guard against skipping into a later step without required base data
  useEffect(() => {
    if (currentStep !== 'upload' && !form.state.values.upload.file) {
      setCurrentStep('upload', { history: 'replace' })
      toast.info('Please start from the beginning')
    }
  }, [currentStep, form, setCurrentStep])

  if (completedTestId) {
    return <TestCompleted testId={completedTestId} onBack={onBack} />
  }

  const currentStepIndex = steps.indexOf(currentStep)
  const isLastStep = currentStepIndex === steps.length - 1

  const handleGroupSubmit = async () => {
    if (!isLastStep) {
      await setCurrentStep(steps[currentStepIndex + 1], { history: 'push' })
      return
    }

    await form.handleSubmit()
  }

  const handleGroupSubmitInvalid = (_error?: unknown) => {
    const focusedField = focusFirstInvalidField(formRef.current)
    toast.error(focusedField ? 'Please fix the highlighted field.' : 'Please complete the required fields.', {
      id: 'lab-confirmation-step-invalid',
    })
  }

  const renderStep = () => {
    const renderGroup = (
      name: 'upload' | 'extract' | 'matchCollection' | 'labConfirmationData' | 'emails',
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
            <LabConfirmationNavigation form={form} group={group} onBack={onBack} />
          </>
        )}
      </form.FormGroup>
    )

    switch (currentStep) {
      case 'upload':
        return renderGroup('upload', { onDynamic: uploadSchema.shape.upload }, <UploadStep form={form} />)
      case 'extract':
        return renderGroup('extract', { onDynamic: extractSchema.shape.extract }, <ExtractStep form={form} />)
      case 'matchCollection':
        return renderGroup(
          'matchCollection',
          { onDynamic: matchCollectionSchema.shape.matchCollection },
          <MatchCollectionStep form={form} />,
        )
      case 'labConfirmationData':
        return renderGroup(
          'labConfirmationData',
          { onDynamic: labConfirmationDataSchema.shape.labConfirmationData },
          <LabConfirmationDataStep form={form} />,
        )
      case 'confirm':
        return renderGroup('labConfirmationData', undefined, <ConfirmStep form={form} />)
      case 'emails':
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

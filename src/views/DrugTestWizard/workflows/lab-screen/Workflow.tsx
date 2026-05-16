'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { getLabScreenFormOpts } from './shared-form'
import { LabScreenNavigation } from './components/Navigation'
import { UploadStep } from './steps/Upload'
import { ExtractStep } from './steps/Extract'
import { MatchCollectionStep } from './steps/MatchCollection'
import { LabScreenDataStep } from './steps/LabScreenData'
import { ConfirmStep } from './steps/confirm/Step'
import { EmailsStep } from './steps/Emails'
import { updateLabScreenWithEmailReview } from './actions/updateLabScreenWithEmailReview'
import { TestCompleted } from '../../components/TestCompleted'
import {
  emailsGroupSchema,
  extractSchema,
  labScreenDataSchema,
  matchCollectionSchema,
  steps,
  uploadSchema,
} from './validators'
import { extractPdfQueryKey } from '../../queries'
import { createZodGroupValidator, getFirstGroupError } from '../form-group-validation'
import { focusFirstInvalidField, useStepFocus } from '@/lib/form-scroll-focus'

interface LabScreenWorkflowProps {
  onBack: () => void
}

export function LabScreenWorkflow({ onBack }: LabScreenWorkflowProps) {
  const queryClient = useQueryClient()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  // URL is single source of truth
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('upload'),
  )
  const currentStep = currentStepRaw as (typeof steps)[number]
  const formRef = useRef<HTMLFormElement | null>(null)

  useStepFocus({
    containerRef: formRef,
    stepKey: currentStep,
  })

  const form = useAppForm({
    ...getLabScreenFormOpts(currentStep),
    onSubmit: async ({ value }) => {
      // Final submit: Update drug test with lab screening results and send emails
      try {
        const queryKey = extractPdfQueryKey(value.upload.file, 'enter-lab-screen')
        const extractedData = queryClient.getQueryData<any>(queryKey)

        const result = await updateLabScreenWithEmailReview(value, extractedData)

        if (result.success && result.testId) {
          setCompletedTestId(result.testId)
        } else {
          toast.error(result.error || 'Failed to update test with screening results')
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

  const renderStep = () => {
    switch (currentStep) {
      case 'upload':
        return <UploadStep form={form} />
      case 'extract':
        return <ExtractStep form={form} />
      case 'matchCollection':
        return <MatchCollectionStep form={form} />
      case 'labScreenData':
        return <LabScreenDataStep form={form} />
      case 'confirm':
        return <ConfirmStep form={form} />
      case 'emails':
        return <EmailsStep form={form} />
      default:
        return <UploadStep form={form} />
    }
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

  const handleGroupSubmitInvalid = (error: unknown) => {
    const message = getFirstGroupError(error)
    if (message) {
      toast.error(message)
    }
    focusFirstInvalidField(formRef.current)
  }

  const groupConfig = (() => {
    switch (currentStep) {
      case 'upload':
        return {
          name: 'upload' as const,
          validators: { onSubmit: createZodGroupValidator(uploadSchema.shape.upload) },
        }
      case 'extract':
        return {
          name: 'extract' as const,
          validators: { onSubmit: createZodGroupValidator(extractSchema.shape.extract) },
        }
      case 'matchCollection':
        return {
          name: 'matchCollection' as const,
          validators: { onSubmit: createZodGroupValidator(matchCollectionSchema.shape.matchCollection) },
        }
      case 'labScreenData':
        return {
          name: 'labScreenData' as const,
          validators: { onSubmit: createZodGroupValidator(labScreenDataSchema.shape.labScreenData) },
        }
      case 'confirm':
        return {
          name: 'labScreenData' as const,
          validators: undefined,
        }
      case 'emails':
        return {
          name: 'emails' as const,
          validators: { onSubmit: createZodGroupValidator(emailsGroupSchema) },
        }
    }
  })()

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
      }}
      className="flex flex-1 flex-col"
    >
      <form.FormGroup
        key={currentStep}
        name={groupConfig.name}
        validators={groupConfig.validators as never}
        onGroupSubmit={handleGroupSubmit}
        onGroupSubmitInvalid={({ groupApi }) => handleGroupSubmitInvalid(groupApi.state.meta.errors)}
      >
        {(group) => (
          <>
            <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
            <LabScreenNavigation form={form} group={group as never} onBack={onBack} />
          </>
        )}
      </form.FormGroup>
    </form>
  )
}

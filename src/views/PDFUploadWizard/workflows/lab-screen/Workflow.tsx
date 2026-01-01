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
import { updateLabScreenAction } from './actions/updateLabScreen'
import { TestCompleted } from '../../components/TestCompleted'
import { steps } from './validators'
import { extractPdfQueryKey } from '../../queries'
import { SubstanceValue } from '@/fields/substanceOptions'

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

  // Track previous step for navigation direction
  const prevStepRef = useRef(currentStep)

  const form = useAppForm({
    ...getLabScreenFormOpts(currentStep),
    onSubmit: async ({ value }) => {
      const currentStepIndex = steps.indexOf(currentStep)
      const isLastStep = currentStepIndex === steps.length - 1

      if (!isLastStep) {
        // Navigate to next step
        await setCurrentStep(steps[currentStepIndex + 1], { history: 'push' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Final submit: Update drug test with lab screening results
      const queryKey = extractPdfQueryKey(value.upload.file, 'enter-lab-screen')
      const extractedData = queryClient.getQueryData<any>(queryKey)

      const result = await updateLabScreenAction(value, extractedData)

      if (result.success && result.testId) {
        setCompletedTestId(result.testId)
      } else {
        toast.error(result.error || 'Failed to update test with screening results')
      }
    },
  })

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-1 flex-col"
    >
      <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
      <LabScreenNavigation form={form} onBack={onBack} />
    </form>
  )
}

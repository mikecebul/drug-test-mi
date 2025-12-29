'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { getCollectLabFormOpts } from './shared-form'
import { CollectLabNavigation } from './components/Navigation'
import { ClientStep } from './steps/Client/Step'
import { MedicationsStep } from './steps/medications/Step'
import { CollectionStep } from './steps/Collection'
import { ConfirmStep } from './steps/Confirm'
import { EmailsStep } from './steps/Emails'
import { createCollectionWithEmailReview } from './actions/createCollectionWithEmailReview'
import { TestCompleted } from '../../components/TestCompleted'
import { steps } from './validators'

interface CollectLabWorkflowProps {
  onBack: () => void
}

export function CollectLabWorkflow({ onBack }: CollectLabWorkflowProps) {
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  // URL is the single source of truth for current step
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('client'),
  )
  const currentStep = currentStepRaw as (typeof steps)[number]

  // Track previous step to detect navigation direction
  const prevStepRef = useRef(currentStep)

  const form = useAppForm({
    ...getCollectLabFormOpts(currentStep),
    onSubmit: async ({ value }) => {
      const currentStepIndex = steps.indexOf(currentStep)
      const isLastStep = currentStepIndex === steps.length - 1

      if (!isLastStep) {
        // Navigate to next step
        await setCurrentStep(steps[currentStepIndex + 1], { history: 'push' })
        return
      }

      // Final submit only happens on last step
      const result = await createCollectionWithEmailReview(
        {
          clientId: value.client.id,
          testType: value.collection.testType,
          collectionDate: value.collection.collectionDate,
          breathalyzerTaken: value.collection.breathalyzerTaken,
          breathalyzerResult: value.collection.breathalyzerResult ?? null,
        },
        value.medications,
        {
          referralEmailEnabled: value.emails.referralEmailEnabled,
          referralRecipients: value.emails.referralRecipients,
        },
      )

      if (result.success && result.testId) {
        setCompletedTestId(result.testId)
      } else {
        toast.error(result.error || 'Failed to create collection record')
      }
    },
  })

  // Handle validation reset on backward navigation
  useEffect(() => {
    const currentIndex = steps.indexOf(currentStep)
    const prevIndex = steps.indexOf(prevStepRef.current)

    // Only validate when going BACKWARD (not forward)
    // This prevents showing validation errors when entering a new step
    if (currentIndex < prevIndex) {
      form.validate('submit')
    }

    // Optional guard: If URL suggests advanced step but form has no client data, restart
    if (currentStep !== 'client' && !form.state.values.client.id) {
      setCurrentStep('client', { history: 'replace' })
      toast.info('Please start from the beginning')
    }

    // Update ref for next comparison
    prevStepRef.current = currentStep
  }, [currentStep, form, setCurrentStep])

  if (completedTestId) {
    return <TestCompleted testId={completedTestId} onBack={onBack} />
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'client':
        return <ClientStep form={form} />
      case 'medications':
        return <MedicationsStep form={form} />
      case 'collection':
        return <CollectionStep form={form} />
      case 'confirm':
        return <ConfirmStep form={form} />
      case 'reviewEmails':
        return <EmailsStep form={form} />
      default:
        return <ClientStep form={form} />
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
      <CollectLabNavigation form={form} onBack={onBack} />
    </form>
  )
}

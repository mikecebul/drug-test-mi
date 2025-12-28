import { useState } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { toast } from 'sonner'
import { collectLabFormOpts } from './shared-form'
import { CollectLabNavigation } from './components/Navigation'
import { ClientStep } from './steps/Client/Step'
import { MedicationsStep } from './steps/medications/Step'
import { CollectionStep } from './steps/Collection'
import { ConfirmStep } from './steps/Confirm'
import { EmailsStep } from './steps/Emails'
import { createCollectionWithEmailReview } from './actions'
import { TestCompleted } from '../../components/TestCompleted'
import { steps } from './validators'

interface CollectLabWorkflowProps {
  onBack: () => void
}

export function CollectLabWorkflow({ onBack }: CollectLabWorkflowProps) {
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)
  const form = useAppForm({
    ...collectLabFormOpts,
    onSubmit: async ({ value, formApi }) => {
      const currentStepIndex = steps.indexOf(value.step)
      const nextStep = steps[currentStepIndex + 1]
      const isLastStep = currentStepIndex === steps.length - 1
      
      if (isLastStep) {
          const result = await createCollectionWithEmailReview(
            {
              clientId: value.client.id,
              testType: value.collection.testType,
              collectionDate: value.collection.collectionDate,
              breathalyzerTaken: value.collection.breathalyzerTaken,
              breathalyzerResult: value.collection.breathalyzerResult ?? null,
            },
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
        } else {
        formApi.setFieldValue('step', nextStep)
      }
    },
  })

  const [step] = useStore(form.store, (state) => [state.values.step])

  if (completedTestId) {
    return <TestCompleted testId={completedTestId} onBack={onBack} />
  }

  const renderStep = () => {
    switch (step) {
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

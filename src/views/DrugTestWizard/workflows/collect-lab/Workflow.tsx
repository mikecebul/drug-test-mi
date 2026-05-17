'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral, parseAsString } from 'nuqs'
import { getCollectLabFormOpts } from './shared-form'
import { CollectLabNavigation } from './components/Navigation'
import { ClientStep } from './steps/Client/Step'
import { MedicationsStep } from './steps/medications/Step'
import { CollectionStep } from './steps/Collection'
import { ConfirmStep } from './steps/Confirm'
import { EmailsStep } from './steps/Emails'
import { createCollectionWithEmailReview } from './actions/createCollectionWithEmailReview'
import { TestCompleted } from '../../components/TestCompleted'
import { clientSchema, collectionSchema, emailsGroupSchema, medicationsSchema, steps } from './validators'
import { getClientById } from '../components/client/getClients'
import { getFirstGroupError } from '../form-group-errors'
import { focusFirstInvalidField, useStepFocus } from '@/lib/form-scroll-focus'

interface CollectLabWorkflowProps {
  onBack: () => void
}

export function CollectLabWorkflow({ onBack }: CollectLabWorkflowProps) {
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  // URL is the single source of truth for current step
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps).withDefault('client'),
  )
  const currentStep = currentStepRaw as (typeof steps)[number]

  // Manage clientId param for pre-populating from registration workflow
  const [clientId, setClientId] = useQueryState('clientId', parseAsString)
  const formRef = useRef<HTMLFormElement | null>(null)

  useStepFocus({
    containerRef: formRef,
    stepKey: currentStep,
  })

  const form = useAppForm({
    ...getCollectLabFormOpts(),
    onSubmit: async ({ value }) => {
      // Final submit only happens on last step
      try {
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
      } catch (error) {
        console.error('Unexpected error during submission:', error)
        toast.error('An unexpected error occurred. Please try again.')
      }
    },
  })

  // Guard against skipping into a later step without required base data
  useEffect(() => {
    if (currentStep !== 'client' && !form.state.values.client.id) {
      setCurrentStep('client', { history: 'replace' })
      toast.info('Please start from the beginning')
    }
  }, [currentStep, form, setCurrentStep])

  // Handle client pre-population from registration workflow
  useEffect(() => {
    if (clientId && currentStep === 'client' && !form.state.values.client.id) {
      // Fetch client by ID and populate form
      const fetchAndPopulateClient = async () => {
        try {
          const client = await getClientById(clientId)
          if (client) {
            form.setFieldValue('client.id', client.id)
            form.setFieldValue('client.firstName', client.firstName)
            form.setFieldValue('client.lastName', client.lastName)
            form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
            form.setFieldValue('client.email', client.email)
            form.setFieldValue('client.dob', client.dob ?? null)
            form.setFieldValue('client.headshot', client.headshot ?? null)

            toast.success(`Client ${client.firstName} ${client.lastName} pre-selected`)

            // Clear the clientId param after population
            setClientId(null)
          }
        } catch (error) {
          console.error('Failed to fetch client:', error)
          toast.error('Failed to load client information')
          // Clear the clientId param on error
          setClientId(null)
        }
      }

      fetchAndPopulateClient()
    }
  }, [clientId, currentStep, form, setClientId])

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
      case 'client':
        return {
          name: 'client' as const,
          validators: { onDynamic: clientSchema.shape.client },
        }
      case 'medications':
        return {
          name: 'medications' as const,
          validators: { onDynamic: medicationsSchema.shape.medications },
        }
      case 'collection':
        return {
          name: 'collection' as const,
          validators: { onDynamic: collectionSchema.shape.collection },
        }
      case 'confirm':
        return {
          name: 'collection' as const,
          validators: undefined,
        }
      case 'reviewEmails':
        return {
          name: 'emails' as const,
          validators: { onDynamic: emailsGroupSchema },
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
        validationLogic={revalidateLogic()}
        validators={groupConfig.validators as never}
        onGroupSubmit={handleGroupSubmit}
        onGroupSubmitInvalid={({ groupApi }) => handleGroupSubmitInvalid(groupApi.state.meta.errors)}
      >
        {(group) => (
          <>
            <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
            <CollectLabNavigation form={form} group={group as never} onBack={onBack} />
          </>
        )}
      </form.FormGroup>
    </form>
  )
}

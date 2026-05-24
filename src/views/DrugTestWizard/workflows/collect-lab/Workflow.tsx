'use client'

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
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
  const currentStep = currentStepRaw

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
      id: 'collect-lab-step-invalid',
    })
  }

  const renderStep = () => {
    const renderGroup = (
      name: 'client' | 'medications' | 'collection' | 'emails',
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
            <CollectLabNavigation form={form} group={group} onBack={onBack} />
          </>
        )}
      </form.FormGroup>
    )

    switch (currentStep) {
      case 'client':
        return renderGroup('client', { onDynamic: clientSchema.shape.client }, <ClientStep form={form} />)
      case 'medications':
        return renderGroup('medications', { onDynamic: medicationsSchema.shape.medications }, <MedicationsStep form={form} />)
      case 'collection':
        return renderGroup('collection', { onDynamic: collectionSchema.shape.collection }, <CollectionStep form={form} />)
      case 'confirm':
        return renderGroup('collection', undefined, <ConfirmStep form={form} />)
      case 'reviewEmails':
        return renderGroup('emails', { onDynamic: emailsGroupSchema }, <EmailsStep form={form} />)
      default:
        return renderGroup('client', { onDynamic: clientSchema.shape.client }, <ClientStep form={form} />)
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

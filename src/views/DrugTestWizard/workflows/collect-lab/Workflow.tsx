'use client'

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
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
import { clientSchema, collectionSchema, emailsGroupSchema, labTests, medicationsSchema, steps } from './validators'
import { getClientByBookingId, getClientById } from '../components/client/getClients'
import { focusFirstInvalidField, useStepFocus } from '@/lib/form-scroll-focus'

interface CollectLabWorkflowProps {
  onBack: () => void
}

export function CollectLabWorkflow({ onBack }: CollectLabWorkflowProps) {
  const router = useRouter()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)
  const [isHydratingClient, setIsHydratingClient] = useState(false)

  // URL is the single source of truth for current step
  const [currentStep, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps).withDefault('client'),
  )

  // Manage clientId param for pre-populating from registration workflow
  const [clientId, setClientId] = useQueryState('clientId', parseAsString)
  const [presetTestType] = useQueryState('testType', parseAsStringLiteral(labTests))
  const [bookingId] = useQueryState('bookingId', parseAsString)
  const hydratedClientIdRef = useRef<string | null>(null)
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
            bookingId,
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

  useEffect(() => {
    if (presetTestType) {
      form.setFieldValue('collection.testType', presetTestType)
    }
  }, [form, presetTestType])

  // Handle client pre-population from scheduled collection or registration workflow.
  useEffect(() => {
    if (form.state.values.client.id) return
    if (!clientId && !bookingId) return

    const hydrationKey = clientId ?? bookingId
    if (!hydrationKey || hydratedClientIdRef.current === hydrationKey) return

    const fetchAndPopulateClient = async () => {
      setIsHydratingClient(true)
      try {
        const client = clientId ? await getClientById(clientId) : await getClientByBookingId(hydrationKey)
        if (client && hydratedClientIdRef.current !== client.id) {
          form.setFieldValue('client.id', client.id)
          form.setFieldValue('client.firstName', client.firstName)
          form.setFieldValue('client.lastName', client.lastName)
          form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
          form.setFieldValue('client.email', client.email)
          form.setFieldValue('client.dob', client.dob ?? null)
          form.setFieldValue('client.headshot', client.headshot ?? null)

          hydratedClientIdRef.current = client.id
          if (!bookingId) {
            toast.success(`Client ${client.firstName} ${client.lastName} pre-selected`, {
              id: `collect-lab-client-${client.id}`,
            })
          }

          if (clientId && !bookingId) {
            setClientId(null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch client:', error)
        toast.error('Failed to load client information')
        if (clientId && !bookingId) {
          setClientId(null)
        }
      } finally {
        setIsHydratingClient(false)
      }
    }

    fetchAndPopulateClient()
  }, [bookingId, clientId, form, setClientId])

  // Guard against skipping into a later step without required base data.
  // Guided booking URLs can hydrate the client from bookingId after a refresh.
  useEffect(() => {
    if (currentStep !== 'client' && !clientId && !bookingId && !isHydratingClient && !form.state.values.client.id) {
      setCurrentStep('client', { history: 'replace' })
      toast.info('Please start from the beginning')
    }
  }, [bookingId, clientId, currentStep, form, isHydratingClient, setCurrentStep])

  if (completedTestId) {
    return (
      <TestCompleted
        testId={completedTestId}
        onBack={() => {
          if (bookingId) {
            router.push(`/admin/drug-test-upload?workflow=guided&step=schedule&bookingId=${bookingId}`)
            return
          }
          onBack()
        }}
        backLabel={bookingId ? "Back to Today's Schedule" : undefined}
      />
    )
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

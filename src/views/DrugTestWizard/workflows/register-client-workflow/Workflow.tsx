'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral, parseAsString } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { getRegisterClientFormOpts } from './shared-form'
import {
  formSchema,
  steps,
} from './validators'

import { PersonalInfoStep } from './steps/PersonalInfo'
import { AccountInfoStep } from './steps/AccountInfo'
import { ScreeningTypeStep } from './steps/ScreeningType'
import { RecipientsStep } from './steps/Recipients'
import { TermsStep } from './steps/Terms'
import { SuccessStep } from './steps/Success'
import { registerClientAction } from './actions/registerClientAction'
import { useRouter } from 'next/navigation'
import { focusFirstInvalidField, useStepFocus } from '@/lib/form-scroll-focus'
import {
  getBookingRegistrationDefaults,
  linkBookingToClient,
} from '../complete-workflow/actions'

interface RegisterClientWorkflowProps {
  onBack: () => void
}

export function RegisterClientWorkflow({ onBack }: RegisterClientWorkflowProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [createdClientId, setCreatedClientId] = useState<string | null>(null)
  const [createdClientData, setCreatedClientData] = useState<{
    firstName: string
    lastName: string
    middleInitial?: string | null
    email: string
    dob: string
    phone: string
  } | null>(null)

  // URL is single source of truth for current step
  const [currentStep, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps).withDefault('personalInfo'),
  )

  // Get returnTo param to know where user came from
  const [returnTo] = useQueryState('returnTo', parseAsString)
  const [bookingId] = useQueryState('bookingId', parseAsString)
  const formRef = useRef<HTMLFormElement | null>(null)

  useStepFocus({
    containerRef: formRef,
    stepKey: currentStep,
  })

  const form = useAppForm({
    ...getRegisterClientFormOpts(),
    onSubmit: async ({ value }) => {
      // Final submit on last step
      const registrationValues = formSchema.parse({
        ...value,
        personalInfo: {
          ...value.personalInfo,
          headshot: null,
        },
      })

      const result = await registerClientAction(registrationValues)

      if (result.success && result.clientId) {
        setCreatedClientId(result.clientId)
        setCreatedClientData({
          firstName: value.personalInfo.firstName,
          lastName: value.personalInfo.lastName,
          middleInitial: value.personalInfo.middleInitial,
          email: result.clientEmail || value.accountInfo.email || '',
          dob: typeof value.personalInfo.dob === 'string'
            ? value.personalInfo.dob
            : value.personalInfo.dob.toISOString(),
          phone: value.personalInfo.phone,
        })
        setRegistrationComplete(true)

        // Clear the step param so browser back goes to wizard selector
        await setCurrentStep(null)

        // Invalidate client queries
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        queryClient.invalidateQueries({ queryKey: ['matching-clients'] })
        queryClient.invalidateQueries({ queryKey: ['all-clients'] })

        toast.success('Client registered successfully!')
      } else {
        toast.error(result.error || 'Failed to register client')
      }
    },
  })

  useEffect(() => {
    if (!bookingId) return
    if (form.state.values.personalInfo.firstName || form.state.values.accountInfo.email) return

    getBookingRegistrationDefaults(bookingId)
      .then((defaults) => {
        if (defaults.firstName) form.setFieldValue('personalInfo.firstName', defaults.firstName)
        if (defaults.lastName) form.setFieldValue('personalInfo.lastName', defaults.lastName)
        if (defaults.email) form.setFieldValue('accountInfo.email', defaults.email)
        if (defaults.phone) form.setFieldValue('personalInfo.phone', defaults.phone)
      })
      .catch((error) => {
        console.error('Failed to load booking registration defaults:', error)
      })
  }, [bookingId, form])

  // Guard against skipping into a later step without required base data
  useEffect(() => {
    if (currentStep !== 'personalInfo' && !form.state.values.personalInfo.firstName) {
      router.push('/admin/drug-test-upload')
    }
  }, [currentStep, form, router])

  // If registration complete, show success screen
  if (registrationComplete && createdClientId && createdClientData) {
    const handleContinue = async () => {
      // Determine where to navigate based on returnTo param
      if (returnTo === 'instant-test' || returnTo === '15-panel-instant' || returnTo === '17-panel-instant') {
        // Navigate to instant-test workflow with new client
        router.push(
          `/admin/drug-test-upload?workflow=instant-test&step=client&clientId=${createdClientId}`,
        )
      } else if (returnTo === 'collect-lab') {
        // Navigate to collect-lab workflow with new client
        router.push(`/admin/drug-test-upload?workflow=collect-lab&step=client&clientId=${createdClientId}`)
      } else if (returnTo === 'dashboard') {
        router.push('/admin')
      } else if ((returnTo === 'guided' || returnTo === 'complete-workflow') && bookingId) {
        await linkBookingToClient(bookingId, createdClientId)
        router.push(`/admin/drug-test-upload?workflow=guided&step=payment&bookingId=${bookingId}`)
      } else {
        // No specific workflow, return to wizard selector
        onBack()
      }
    }

    return (
      <SuccessStep
        clientId={createdClientId}
        firstName={createdClientData.firstName}
        lastName={createdClientData.lastName}
        email={createdClientData.email}
        middleInitial={createdClientData.middleInitial}
        dob={createdClientData.dob}
        phone={createdClientData.phone}
        onContinue={handleContinue}
        returnTo={returnTo}
      />
    )
  }

  const currentStepIndex = steps.indexOf(currentStep)
  const isLastStep = currentStepIndex === steps.length - 1

  const handleNextStep = async () => {
    if (!isLastStep) {
      const nextStep = steps[currentStepIndex + 1]
      if (nextStep) {
        await setCurrentStep(nextStep, { history: 'push' })
      }
      return
    }

    await form.handleSubmit()
  }

  const handleStepInvalid = () => {
    const focusedField = focusFirstInvalidField(formRef.current)
    toast.error(focusedField ? 'Please fix the highlighted field.' : 'Please complete the required fields.', {
      id: 'register-client-step-invalid',
    })
  }

  const renderStep = () => {
    const stepProps = {
      form,
      onBack,
      onInvalid: handleStepInvalid,
      onNext: handleNextStep,
    }

    switch (currentStep) {
      case 'personalInfo':
        return <PersonalInfoStep {...stepProps} />
      case 'accountInfo':
        return <AccountInfoStep {...stepProps} />
      case 'screeningType':
        return <ScreeningTypeStep {...stepProps} />
      case 'recipients':
        return <RecipientsStep {...stepProps} />
      case 'terms':
        return <TermsStep {...stepProps} />
      default:
        return <PersonalInfoStep {...stepProps} />
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className="flex flex-1 flex-col"
    >
      {renderStep()}
    </form>
  )
}

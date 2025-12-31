'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral, parseAsString } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { getRegisterClientFormOpts } from './shared-form'
import { steps } from './validators'

import { PersonalInfoStep } from './steps/PersonalInfo'
import { AccountInfoStep } from './steps/AccountInfo'
import { ScreeningTypeStep } from './steps/ScreeningType'
import { RecipientsStep } from './steps/Recipients'
import { TermsStep } from './steps/Terms'
import { SuccessStep } from './steps/Success'
import { RegisterClientNavigation } from './components/Navigation'
import { registerClientAction } from './actions/registerClientAction'
import { useRouter } from 'next/navigation'

interface RegisterClientWorkflowProps {
  onBack: () => void
}

export function RegisterClientWorkflow({ onBack }: RegisterClientWorkflowProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [createdClientId, setCreatedClientId] = useState<string | null>(null)
  const [createdClientName, setCreatedClientName] = useState<string>('')
  const [usedPassword, setUsedPassword] = useState<string>('')

  // URL is single source of truth for current step
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('personalInfo'),
  )
  const currentStep = currentStepRaw as (typeof steps)[number]

  // Get returnTo param to know where user came from
  const [returnTo] = useQueryState('returnTo', parseAsString)

  // Track previous step for navigation direction
  const prevStepRef = useRef(currentStep)

  const form = useAppForm({
    ...getRegisterClientFormOpts(currentStep),
    onSubmit: async ({ value }) => {
      const currentStepIndex = steps.indexOf(currentStep)
      const isLastStep = currentStepIndex === steps.length - 1

      if (!isLastStep) {
        // Navigate to next step
        await setCurrentStep(steps[currentStepIndex + 1], { history: 'push' })
        return
      }

      // Final submit on last step
      const result = await registerClientAction(value)

      if (result.success && result.clientId) {
        setCreatedClientId(result.clientId)
        setCreatedClientName(`${result.clientFirstName} ${result.clientLastName}`)
        setUsedPassword(value.accountInfo.password)
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

  // Handle validation reset on backward navigation
  useEffect(() => {
    const currentIndex = steps.indexOf(currentStep)
    const prevIndex = steps.indexOf(prevStepRef.current)

    // Only reset validation when going BACKWARD (not forward)
    if (currentIndex < prevIndex) {
      form.validate('submit')
    }
    if (currentStep !== 'personalInfo' && !form.state.values.personalInfo.firstName) {
      router.push('/admin/drug-test-upload')
    }
    prevStepRef.current = currentStep
  }, [currentStep, form])

  // If registration complete, show success screen
  if (registrationComplete && createdClientId) {
    const handleContinue = async () => {
      // Determine where to navigate based on returnTo param
      if (returnTo === 'instant-test') {
        // Navigate to instant-test workflow with new client
        router.push(
          `/admin/drug-test-upload?workflow=15-panel-instant&step=client&clientId=${createdClientId}`,
        )
      } else if (returnTo === 'collect-lab') {
        // Navigate to collect-lab workflow with new client
        router.push(`/admin/drug-test-upload?workflow=collect-lab&step=client&clientId=${createdClientId}`)
      } else {
        // No specific workflow, return to wizard selector
        onBack()
      }
    }

    return (
      <SuccessStep
        clientName={createdClientName}
        password={usedPassword}
        onContinue={handleContinue}
        returnTo={returnTo}
      />
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'personalInfo':
        return <PersonalInfoStep form={form} />
      case 'accountInfo':
        return <AccountInfoStep form={form} />
      case 'screeningType':
        return <ScreeningTypeStep form={form} />
      case 'recipients':
        return <RecipientsStep form={form} />
      case 'terms':
        return <TermsStep form={form} />
      default:
        return <PersonalInfoStep form={form} />
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="flex flex-1 flex-col"
    >
      <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
      <RegisterClientNavigation form={form} onBack={onBack} />
    </form>
  )
}

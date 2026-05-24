'use client'

import { useCallback, useRef, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useStore } from '@tanstack/react-form'
import {
  focusFirstInvalidField,
  useStepFocus,
} from '@/lib/form-scroll-focus'
import { getClientSideURL } from '@/utilities/getURL'
import { Button } from '@/components/ui/button'
import {
  completeRegistrationSchema,
  steps,
} from './validators'
import { getRegisterClientFormOpts } from './shared-form'
import {
  PersonalInfoStep,
  AccountInfoStep,
  ScreeningTypeStep,
  RecipientsStep,
  MedicationsStep,
  TermsStep,
} from './steps'
import { registerWebsiteClientAction } from './actions'

interface RegisterClientWorkflowProps {
  onComplete?: () => void
}

function ProgressBar({
  stepIndex,
}: {
  stepIndex: number
}) {
  return (
    <div className="mb-8 w-full">
      <div className="mb-2 flex justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isComplete = index < stepIndex
          const isActive = index <= stepIndex
          return (
            <div
              key={step}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {isComplete ? <Check className="h-5 w-5" /> : stepNumber}
            </div>
          )
        })}
      </div>
      <div className="relative">
        <div className="bg-border absolute inset-0 h-1 rounded-full"></div>
        <div
          className="bg-primary absolute h-1 rounded-full transition-all duration-500"
          style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  )
}

export function RegisterClientWorkflow({ onComplete }: RegisterClientWorkflowProps) {
  const router = useRouter()
  const [showCompletionFallback, setShowCompletionFallback] = useState(false)
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps).withDefault('personalInfo'),
  )

  const currentStep = currentStepRaw
  const stepIndex = steps.indexOf(currentStep)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1

  const formRef = useRef<HTMLFormElement | null>(null)

  const goToDashboard = useCallback(() => {
    router.push('/dashboard')
    router.refresh()
  }, [router])

  useStepFocus({
    containerRef: formRef,
    disabled: showCompletionFallback,
    stepKey: currentStep,
  })

  const form = useAppForm({
    ...getRegisterClientFormOpts(),
    onSubmit: async ({ value }) => {
      try {
        const registrationValues = completeRegistrationSchema.parse({
          ...value,
          personalInfo: {
            ...value.personalInfo,
            headshot: null,
          },
        })

        const result = await registerWebsiteClientAction(registrationValues)
        if (!result.success) {
          throw new Error(result.error || 'Registration failed')
        }

        const loginRequest = await fetch(`${getClientSideURL()}/api/clients/login`, {
          body: JSON.stringify({
            email: value.accountInfo.email.trim().toLowerCase(),
            password: value.accountInfo.password,
          }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })

        if (!loginRequest.ok) {
          const loginResponse = await loginRequest.json().catch(() => null)
          const errorMessage =
            loginResponse?.errors?.[0]?.message ||
            loginResponse?.message ||
            'Registration succeeded, but automatic sign-in failed. Please sign in.'

          setShowCompletionFallback(true)
          onComplete?.()
          toast.success('Registration complete!', {
            description: errorMessage,
          })
          return
        }

        onComplete?.()
        toast.success('Registration complete!', {
          description: 'Taking you to your dashboard now.',
        })

        try {
          goToDashboard()
        } catch (error) {
          console.error('Dashboard redirect failed:', error)
          setShowCompletionFallback(true)
        }
      } catch (error) {
        console.error('Registration error:', error)

        if (
          error instanceof Error &&
          !error.message.includes('already exists') &&
          !error.message.includes('Server error') &&
          !error.message.includes('check your information')
        ) {
          toast.error(error instanceof Error ? error.message : 'Registration failed. Please try again.')
        }
        throw error
      }
    },
  })

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const handlePrevious = () => {
    if (isFirstStep) return
    const previousStep = steps[stepIndex - 1]
    if (previousStep) {
      setCurrentStep(previousStep, { history: 'push' })
    }
  }

  const handleNextStep = async () => {
    if (!isLastStep) {
      const nextStep = steps[stepIndex + 1]
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
      id: 'registration-step-invalid',
    })
  }

  const renderStep = () => {
    const stepProps = {
      form,
      mode: 'wizard' as const,
      isFirstStep,
      isLastStep,
      isSubmitting,
      onBack: handlePrevious,
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
      case 'medications':
        return <MedicationsStep {...stepProps} />
      case 'terms':
        return <TermsStep {...stepProps} />
      default:
        return <PersonalInfoStep {...stepProps} />
    }
  }

  if (showCompletionFallback) {
    return (
      <div className="flex min-h-90 flex-col items-center justify-center text-center" role="status">
        <div className="bg-primary/10 mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <div className="bg-primary flex h-14 w-14 items-center justify-center rounded-full">
            <Check className="text-primary-foreground h-7 w-7" strokeWidth={3} />
          </div>
        </div>
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">Submission Successful</h2>
        <p className="text-muted-foreground mt-3 max-w-sm text-base">
          Your registration is complete. Continue to your dashboard when you&apos;re ready.
        </p>
        <Button type="button" className="mt-8" onClick={goToDashboard}>
          Go to dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    )
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
      <ProgressBar stepIndex={stepIndex} />
      {renderStep()}
    </form>
  )
}

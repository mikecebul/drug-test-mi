'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useStore } from '@tanstack/react-form'
import {
  focusElementWithoutScroll,
  focusFirstInteractiveField,
  scrollElementIntoViewWithMargin,
} from '@/lib/form-scroll-focus'
import { getClientSideURL } from '@/utilities/getURL'
import { Button } from '@/components/ui/button'
import { completeRegistrationSchema, steps } from './validators'
import { getRegisterClientFormOpts } from './shared-form'
import { RegisterNavigation } from './components/Navigation'
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

export function RegisterClientWorkflow({ onComplete }: RegisterClientWorkflowProps) {
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const redirectTimeoutRef = useRef<number | null>(null)
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('personalInfo'),
  )

  const currentStep = (currentStepRaw ?? 'personalInfo') as (typeof steps)[number]
  const stepIndex = steps.indexOf(currentStep)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1
  const prevStepRef = useRef(currentStep)
  const hasInitializedStepRef = useRef(false)

  const formRef = useRef<HTMLFormElement | null>(null)

  const goToDashboard = useCallback(() => {
    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }

    router.push('/dashboard')
    router.refresh()
  }, [router])

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isRedirecting) return

    const firstField = focusFirstInteractiveField(formRef.current)

    if (!hasInitializedStepRef.current) {
      hasInitializedStepRef.current = true
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })

    focusElementWithoutScroll(firstField)
  }, [currentStep, isRedirecting])

  const form = useAppForm({
    ...getRegisterClientFormOpts(currentStep),
    onSubmitInvalid: ({ formApi }) => {
      const errorMaps = Array.isArray(formApi.state.errors) ? formApi.state.errors : [formApi.state.errors]

      const stepErrorField = errorMaps
        .flatMap((errorMap) => {
          if (!errorMap) return []
          return Object.keys(errorMap)
        })
        .find((fieldName) => {
          switch (currentStep) {
            case 'personalInfo':
              return fieldName.startsWith('personalInfo.')
            case 'accountInfo':
              return fieldName.startsWith('accountInfo.')
            case 'screeningType':
              return fieldName.startsWith('screeningType.')
            case 'recipients':
              return fieldName.startsWith('recipients.')
            case 'medications':
              return fieldName.startsWith('medications.')
            case 'terms':
              return fieldName.startsWith('terms.')
            default:
              return false
          }
        })

      const target =
        (stepErrorField && document.getElementById(stepErrorField)) ||
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')

      if (target) {
        scrollElementIntoViewWithMargin(target, {
          behavior: 'smooth',
          block: 'center',
        })
        focusElementWithoutScroll(target)
      }
    },
    onSubmit: async ({ value }) => {
      const currentStepIndex = steps.indexOf(currentStep)
      const isLast = currentStepIndex === steps.length - 1

      if (!isLast) {
        const nextStep = steps[currentStepIndex + 1]
        if (nextStep) {
          await setCurrentStep(nextStep, { history: 'push' })
          return
        }
      }

      try {
        if (value.accountInfo.password !== value.accountInfo.confirmPassword) {
          throw new Error('Passwords do not match')
        }

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

          throw new Error(errorMessage)
        }

        setIsRedirecting(true)
        onComplete?.()
        toast.success('Registration complete!', {
          description: 'Taking you to your dashboard.',
        })
        redirectTimeoutRef.current = window.setTimeout(goToDashboard, 1000)
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

  useEffect(() => {
    const currentIndex = steps.indexOf(currentStep)
    const prevIndex = steps.indexOf(prevStepRef.current)

    if (currentIndex < prevIndex) {
      void form.validate('submit')
    }

    prevStepRef.current = currentStep
  }, [currentStep, form])

  const [isSubmitting, errors] = useStore(form.store, (state) => [state.isSubmitting, state.errors])

  const currentStepHasErrors = useMemo(() => {
    const errorMaps = Array.isArray(errors) ? errors : [errors]
    return errorMaps.some((errorMap) => {
      if (!errorMap) return false
      const fieldNames = Object.keys(errorMap)
      return fieldNames.some((fieldName) => {
        switch (currentStep) {
          case 'personalInfo':
            return fieldName.startsWith('personalInfo.')
          case 'accountInfo':
            return fieldName.startsWith('accountInfo.')
          case 'screeningType':
            return fieldName.startsWith('screeningType.')
          case 'recipients':
            return fieldName.startsWith('recipients.')
          case 'medications':
            return fieldName.startsWith('medications.')
          case 'terms':
            return fieldName.startsWith('terms.')
          default:
            return false
        }
      })
    })
  }, [currentStep, errors])

  const handlePrevious = () => {
    if (isFirstStep) return
    const previousStep = steps[stepIndex - 1]
    if (previousStep) {
      setCurrentStep(previousStep, { history: 'push' })
    }
  }

  const ProgressBar = () => (
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
      case 'medications':
        return <MedicationsStep form={form} />
      case 'terms':
        return <TermsStep form={form} />
      default:
        return <PersonalInfoStep form={form} />
    }
  }

  if (isRedirecting) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center text-center" role="status">
        <div className="bg-primary/10 mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <div className="bg-primary flex h-14 w-14 items-center justify-center rounded-full">
            <Check className="text-primary-foreground h-7 w-7" strokeWidth={3} />
          </div>
        </div>
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">Submission Successful</h2>
        <p className="text-muted-foreground mt-3 max-w-sm text-base">
          Your registration is complete. We&apos;re signing you in and forwarding you to your dashboard.
        </p>
        <div className="text-muted-foreground mt-6 flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting to dashboard
        </div>
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
        form.handleSubmit()
      }}
      className="flex flex-1 flex-col"
    >
      <ProgressBar />
      <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
      <RegisterNavigation
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        isSubmitting={isSubmitting}
        isNextDisabled={currentStepHasErrors}
        onBack={handlePrevious}
        onNext={() => form.handleSubmit()}
      />
    </form>
  )
}

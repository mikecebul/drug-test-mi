'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useStore } from '@tanstack/react-form'
import {
  focusElementWithoutScroll,
  scrollElementIntoViewWithMargin,
} from '@/lib/form-scroll-focus'
import { useStepFocus } from '@/lib/use-step-focus'
import { getClientSideURL } from '@/utilities/getURL'
import { Button } from '@/components/ui/button'
import {
  accountInfoSchema,
  completeRegistrationSchema,
  medicationsSchema,
  personalInfoSchema,
  recipientsSchema,
  screeningTypeSchema,
  steps,
  termsSchema,
} from './validators'
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
import { checkEmailExists } from './actions'
import {
  createZodGroupValidator,
  getFirstGroupError,
  zodErrorToGroupError,
} from '@/views/DrugTestWizard/workflows/form-group-validation'
import z from 'zod'

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
  const [groupError, setGroupError] = useState<string | null>(null)
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('personalInfo'),
  )

  const currentStep = (currentStepRaw ?? 'personalInfo') as (typeof steps)[number]
  const stepIndex = steps.indexOf(currentStep)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1

  const formRef = useRef<HTMLFormElement | null>(null)

  const goToDashboard = useCallback(() => {
    router.push('/dashboard')
    router.refresh()
  }, [router])

  const clearGroupError = useCallback(() => {
    setGroupError(null)
  }, [])

  useStepFocus({
    containerRef: formRef,
    disabled: showCompletionFallback,
    onStepChange: clearGroupError,
    stepKey: currentStep,
  })

  const form = useAppForm({
    ...getRegisterClientFormOpts(currentStep),
    onSubmit: async ({ value }) => {
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

  const handleGroupSubmit = async () => {
    setGroupError(null)
    if (!isLastStep) {
      const nextStep = steps[stepIndex + 1]
      if (nextStep) {
        await setCurrentStep(nextStep, { history: 'push' })
      }
      return
    }

    await form.handleSubmit()
  }

  const handleGroupSubmitInvalid = (error: unknown) => {
    const metaMessage = getFirstGroupError(error)
    if (!metaMessage) {
      const fallbackMessage = getCurrentStepErrorMessage()
      setGroupError(fallbackMessage?.toLowerCase().includes('recipient') ? fallbackMessage : null)
    }

    const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (target) {
      scrollElementIntoViewWithMargin(target, {
        behavior: 'smooth',
        block: 'center',
      })
      focusElementWithoutScroll(target)
    }
  }

  const getCurrentStepErrorMessage = () => {
    const value = form.state.values
    if (
      currentStep === 'recipients' &&
      value.recipients.additionalReferralRecipients?.some((recipient) => !recipient.email?.trim())
    ) {
      return 'Recipient email is required'
    }

    const result = (() => {
      switch (currentStep) {
        case 'personalInfo':
          return personalInfoSchema.safeParse({ personalInfo: value.personalInfo })
        case 'accountInfo':
          return accountInfoSchema.safeParse({ accountInfo: value.accountInfo })
        case 'screeningType':
          return screeningTypeSchema.safeParse({ screeningType: value.screeningType })
        case 'recipients':
          return recipientsSchema.safeParse({
            recipients: value.recipients,
            screeningType: value.screeningType,
          })
        case 'medications':
          return medicationsSchema.safeParse({ medications: value.medications })
        case 'terms':
          return termsSchema.safeParse({ terms: value.terms })
      }
    })()

    return result.success ? undefined : result.error.issues[0]?.message
  }

  const groupConfig = useMemo(() => {
    switch (currentStep) {
      case 'personalInfo':
        return {
          name: 'personalInfo' as const,
          validators: { onSubmit: createZodGroupValidator(personalInfoSchema.shape.personalInfo) },
        }
      case 'accountInfo':
        return {
          name: 'accountInfo' as const,
          validators: {
            onSubmit: ({ value }: { value: typeof form.state.values.accountInfo }) => {
              const result = accountInfoSchema.safeParse({ accountInfo: value })
              return result.success ? undefined : zodErrorToGroupError(result.error, 'accountInfo')
            },
            onSubmitAsync: async ({ value }: { value: typeof form.state.values.accountInfo }) => {
              const normalizedEmail = value.email.trim().toLowerCase()
              if (!normalizedEmail || !z.email().safeParse(normalizedEmail).success) {
                return undefined
              }
              try {
                const emailExists = await checkEmailExists(normalizedEmail)
                if (emailExists) {
                  return {
                    fields: {
                      email: 'An account with this email already exists',
                    },
                  }
                }
              } catch (error) {
                console.warn('Failed to check email existence:', error)
              }
              return undefined
            },
          },
        }
      case 'screeningType':
        return {
          name: 'screeningType' as const,
          validators: { onSubmit: createZodGroupValidator(screeningTypeSchema.shape.screeningType) },
        }
      case 'recipients':
        return {
          name: 'recipients' as const,
          validators: {
            onSubmit: ({ value }: { value: typeof form.state.values.recipients }) => {
              const result = recipientsSchema.safeParse({
                recipients: value,
                screeningType: form.state.values.screeningType,
              })
              return result.success ? undefined : zodErrorToGroupError(result.error, 'recipients')
            },
          },
        }
      case 'medications':
        return {
          name: 'medications' as const,
          validators: { onSubmit: createZodGroupValidator(medicationsSchema.shape.medications) },
        }
      case 'terms':
        return {
          name: 'terms' as const,
          validators: { onSubmit: createZodGroupValidator(termsSchema.shape.terms) },
        }
    }
  }, [currentStep, form])

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

  if (showCompletionFallback) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center text-center" role="status">
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
      <form.FormGroup
        key={currentStep}
        name={groupConfig.name}
        validators={groupConfig.validators as never}
        onGroupSubmit={handleGroupSubmit}
        onGroupSubmitInvalid={({ groupApi }) => handleGroupSubmitInvalid(groupApi.state.meta.errors)}
      >
        {(group) => (
          <>
            <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
            {(() => {
              const hasEmptyRecipient =
                currentStep === 'recipients' &&
                form.state.values.recipients.additionalReferralRecipients?.some(
                  (recipient) => !recipient.email?.trim(),
                )
              const medicationErrors =
                currentStep === 'medications' && group.state.meta.submissionAttempts > 0
                  ? form.state.values.medications.flatMap((medication) => [
                      ...(medication.medicationName?.trim() ? [] : ['Medication name is required']),
                      ...(medication.detectedAs?.length ? [] : ['Select at least one detected substance']),
                    ])
                  : []
              const errorMessage =
                groupError ||
                getFirstGroupError(group.state.meta.errors) ||
                getFirstGroupError(group.state.meta.errorMap) ||
                (group.state.meta.submissionAttempts > 0 && hasEmptyRecipient
                  ? 'Recipient email is required'
                  : undefined)
              return errorMessage || medicationErrors.length ? (
                <div className="text-destructive mb-4 space-y-1 text-sm">
                  {errorMessage ? <p>{errorMessage}</p> : null}
                  {medicationErrors.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              ) : null
            })()}
            <RegisterNavigation
              isFirstStep={isFirstStep}
              isLastStep={isLastStep}
              isSubmitting={isSubmitting}
              isNextDisabled={false}
              onBack={handlePrevious}
              onNext={() => group.handleSubmit()}
            />
          </>
        )}
      </form.FormGroup>
    </form>
  )
}

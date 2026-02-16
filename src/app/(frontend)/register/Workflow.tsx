'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Check } from 'lucide-react'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { toast } from 'sonner'
import { useStore } from '@tanstack/react-form'
import { formatDateOnlyISO, getCurrentIsoTimestamp, getTodayDateOnlyISO } from '@/lib/date-utils'
import { formatMiddleInitial, formatPersonName, formatPhoneNumber } from '@/lib/client-utils'
import {
  focusElementWithoutScroll,
  focusFirstInteractiveField,
  scrollElementIntoViewWithMargin,
} from '@/lib/form-scroll-focus'
import { steps } from './validators'
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
import { COURT_CONFIGS, EMPLOYER_CONFIGS, isValidEmployerType, isValidCourtType } from './configs/recipient-configs'

interface RegisterClientWorkflowProps {
  onComplete: (email: string) => void
}

export function RegisterClientWorkflow({ onComplete }: RegisterClientWorkflowProps) {
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

  useEffect(() => {
    const firstField = focusFirstInteractiveField(formRef.current)

    if (!hasInitializedStepRef.current) {
      hasInitializedStepRef.current = true
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })

    focusElementWithoutScroll(firstField)
  }, [currentStep])

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

        const clientType = value.screeningType.requestedBy
        const formattedFirstName = formatPersonName(value.personalInfo.firstName)
        const formattedLastName = formatPersonName(value.personalInfo.lastName)
        const formattedMiddleInitial = formatMiddleInitial(value.personalInfo.middleInitial)
        const formattedPhone = formatPhoneNumber(value.personalInfo.phone)

        const payload: any = {
          name: `${formattedFirstName} ${formattedLastName}`,
          firstName: formattedFirstName,
          lastName: formattedLastName,
          ...(formattedMiddleInitial ? { middleInitial: formattedMiddleInitial } : {}),
          dob: formatDateOnlyISO(value.personalInfo.dob),
          gender: value.personalInfo.gender,
          email: value.accountInfo.email,
          phone: formattedPhone,
          password: value.accountInfo.password,
          clientType: clientType,
          preferredContactMethod: 'email',
        }

        if (value.medications && value.medications.length > 0) {
          const today = getTodayDateOnlyISO()
          const createdAt = getCurrentIsoTimestamp()
          payload.medications = value.medications.map((medication) => ({
            medicationName: medication.medicationName,
            detectedAs: medication.detectedAs,
            startDate: today,
            status: 'active',
            requireConfirmation: false,
            createdAt,
          }))
        }

        if (clientType === 'employment') {
          const selectedEmployer = value.recipients.selectedEmployer
          let employerName = ''
          let recipients: Array<{ name: string; email: string }> = []

          if (isValidEmployerType(selectedEmployer)) {
            const employerConfig = EMPLOYER_CONFIGS[selectedEmployer]
            employerName = employerConfig.label

            if ('recipients' in employerConfig && employerConfig.recipients.length > 0) {
              recipients = [...employerConfig.recipients]
            } else if (selectedEmployer === 'other') {
              employerName = value.recipients.employerName || ''
              recipients = [
                {
                  name: value.recipients.contactName || '',
                  email: value.recipients.contactEmail || '',
                },
              ]
            }
          } else {
            throw new Error('Invalid employer selection')
          }

          if (recipients.length === 0) {
            console.error('Registration failed: No recipients for employer', {
              selectedEmployer,
              employerName,
            })
            throw new Error('No recipients configured for employer. Please contact support.')
          }

          payload.employmentInfo = {
            employerName,
            recipients,
          }
        } else if (clientType === 'probation') {
          const selectedCourt = value.recipients.selectedCourt
          let courtName = ''
          let recipients: Array<{ name: string; email: string }> = []

          if (isValidCourtType(selectedCourt)) {
            const courtConfig = COURT_CONFIGS[selectedCourt]
            courtName = courtConfig.label

            if (courtConfig.recipients.length > 0) {
              recipients = [...courtConfig.recipients]
            } else if (selectedCourt === 'other') {
              courtName = value.recipients.courtName || ''
              recipients = [
                {
                  name: value.recipients.probationOfficerName || '',
                  email: value.recipients.probationOfficerEmail || '',
                },
              ]
            }
          } else {
            throw new Error('Invalid court selection')
          }

          if (recipients.length === 0) {
            console.error('Registration failed: No recipients for court', {
              selectedCourt,
              courtName,
            })
            throw new Error('No recipients configured for court. Please contact support.')
          }

          payload.courtInfo = {
            courtName,
            recipients,
          }
        } else if (clientType === 'self' && !value.recipients.useSelfAsRecipient) {
          payload.selfInfo = {
            recipients: [
              {
                name: value.recipients.alternativeRecipientName,
                email: value.recipients.alternativeRecipientEmail,
              },
            ],
          }
        }

        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('Registration failed', {
            status: response.status,
            email: payload.email,
            clientType: payload.clientType,
            error: result,
          })

          if (response.status === 409) {
            toast.error('An account with this email already exists')
            throw new Error('An account with this email already exists. Please sign in instead.')
          } else if (response.status === 400) {
            toast.error('Invalid registration data')
            throw new Error(result.errors?.[0]?.message || 'Please check your information and try again.')
          } else if (response.status >= 500) {
            toast.error('Server error occurred')
            throw new Error('Server error. Please try again in a few moments.')
          }

          toast.error('Registration failed')
          throw new Error(result.errors?.[0]?.message || 'Registration failed')
        }

        form.reset()
        onComplete(value.accountInfo.email)
        await setCurrentStep(null)
        toast.success('Registration submitted successfully! Please check your email to verify your account.')
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

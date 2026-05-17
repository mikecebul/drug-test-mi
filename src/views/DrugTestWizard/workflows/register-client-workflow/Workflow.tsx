'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useQueryState, parseAsStringLiteral, parseAsString } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { getRegisterClientFormOpts } from './shared-form'
import {
  accountInfoOptionalEmailGroupSchema,
  formSchema,
  getRecipientsGroupSchema,
  personalInfoSchema,
  screeningTypeSchema,
  steps,
  termsSchema,
} from './validators'

import { PersonalInfoStep } from './steps/PersonalInfo'
import { AccountInfoStep } from './steps/AccountInfo'
import { ScreeningTypeStep } from './steps/ScreeningType'
import { RecipientsStep } from './steps/Recipients'
import { TermsStep } from './steps/Terms'
import { SuccessStep } from './steps/Success'
import { RegisterClientNavigation } from './components/Navigation'
import { registerClientAction } from './actions/registerClientAction'
import { useRouter } from 'next/navigation'
import { checkEmailExists } from '@/app/(frontend)/register/actions'
import { getFirstGroupError } from '../form-group-errors'
import z from 'zod'
import { focusFirstInvalidField, useStepFocus } from '@/lib/form-scroll-focus'

interface RegisterClientWorkflowProps {
  onBack: () => void
}

const staticGroupConfigs = {
  personalInfo: {
    name: 'personalInfo' as const,
    validators: { onDynamic: personalInfoSchema.shape.personalInfo },
  },
  screeningType: {
    name: 'screeningType' as const,
    validators: { onDynamic: screeningTypeSchema.shape.screeningType },
  },
  terms: {
    name: 'terms' as const,
    validators: { onDynamic: termsSchema.shape.terms },
  },
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
  const [currentStepRaw, setCurrentStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('personalInfo'),
  )
  const currentStep = currentStepRaw as (typeof steps)[number]

  // Get returnTo param to know where user came from
  const [returnTo] = useQueryState('returnTo', parseAsString)
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
          email: result.clientEmail || value.accountInfo.email,
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

  const currentStepIndex = steps.indexOf(currentStep)
  const isLastStep = currentStepIndex === steps.length - 1

  const handleGroupSubmit = async () => {
    if (!isLastStep) {
      const nextStep = steps[currentStepIndex + 1]
      if (nextStep) {
        await setCurrentStep(nextStep, { history: 'push' })
      }
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

  const accountInfoGroupConfig = {
    name: 'accountInfo' as const,
    validators: {
      onDynamic: accountInfoOptionalEmailGroupSchema,
      onSubmitAsync: async ({ value }: { value: typeof form.state.values.accountInfo }) => {
        if (value.noEmail) {
          return undefined
        }

        const email = value.email
        if (!email || !z.email().safeParse(email).success) {
          return undefined
        }

        try {
          const emailExists = await checkEmailExists(email)
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

  const groupConfig =
    currentStep === 'accountInfo'
      ? accountInfoGroupConfig
      : currentStep === 'recipients'
        ? {
            name: 'recipients' as const,
            validators: {
              onDynamic: getRecipientsGroupSchema(form.state.values.screeningType.requestedBy),
            },
          }
        : staticGroupConfigs[currentStep]

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
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
            {currentStep === 'recipients' &&
            group.state.meta.submissionAttempts > 0 &&
            form.state.values.recipients.additionalReferralRecipients?.some(
              (recipient) => !recipient.email?.trim(),
            ) ? (
              <p className="text-destructive mb-4 text-sm">Recipient email is required</p>
            ) : null}
            <RegisterClientNavigation
              form={form}
              group={group as never}
              onBack={onBack}
            />
          </>
        )}
      </form.FormGroup>
    </form>
  )
}

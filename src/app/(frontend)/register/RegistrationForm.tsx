'use client'

import React, { useState } from 'react'
import { ChevronRight, ChevronLeft, Check, CheckCircle, RefreshCw, Mail } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useRegistrationFormOpts } from './use-registration-form-opts'
import {
  PersonalInfoGroup,
  AccountInfoGroup,
  ScreeningRequestGroup,
  ResultsRecipientGroup,
  TermsAndConditionsGroup,
} from './field-groups'
import { Button } from '@/components/ui/button'
import { useFormStepper } from './hooks/useFormStepper'
import { stepSchemas } from './schemas/registrationSchemas'

export const RegistrationForm = (props?: any) => {
  const [showVerification, setShowVerification] = useState(false)

  const formOpts = useRegistrationFormOpts({ setShowVerification })
  const form = useAppForm({ ...formOpts })

  const {
    currentStep,
    isFirstStep,
    isLastStep,
    handleNextStepOrSubmit,
    handleCancelOrBack,
  } = useFormStepper(stepSchemas)

  // Get form values for display and validation
  const formValues = useStore(form.store, (state) => state.values)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const handleNext = async () => {
    await handleNextStepOrSubmit(form)
  }

  const handlePrevious = () => {
    handleCancelOrBack({
      onBack: () => {},
    })
  }

  const handleResendEmail = () => {
    console.log('Resending verification email to:', formValues.accountInfo?.email)
    toast.success(`Verification email resent to ${formValues.accountInfo?.email}`)
  }

  const ProgressBar = () => (
    <div className="w-full mb-8">
      <div className="flex justify-between mb-2">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
              step <= currentStep
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {step < currentStep ? <Check className="w-5 h-5" /> : step}
          </div>
        ))}
      </div>
      <div className="relative">
        <div className="absolute inset-0 h-1 bg-border rounded-full"></div>
        <div
          className="absolute h-1 bg-primary rounded-full transition-all duration-500"
          style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
        ></div>
      </div>
    </div>
  )

  // Step content mapping
  const stepComponents: Record<number, React.ReactNode> = {
    1: <PersonalInfoGroup form={form} fields="personalInfo" title="Personal Information" />,
    2: <AccountInfoGroup form={form} fields="accountInfo" title="Account Info" />,
    3: <ScreeningRequestGroup form={form} fields="screeningRequest" title="Screening Request" />,
    4: (
      <ResultsRecipientGroup
        form={form}
        fields="resultsRecipient"
        title="Results Recipient"
        requestedBy={formValues.screeningRequest?.requestedBy || ''}
      />
    ),
    5: <TermsAndConditionsGroup form={form} fields="termsAndConditions" title="Terms & Conditions" />,
  }

  if (showVerification) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center w-20 h-20 bg-secondary/20 rounded-full mb-6">
                <CheckCircle className="w-10 h-10 text-secondary" />
              </div>

              <h2 className="text-3xl font-bold text-foreground mb-3">Registration Complete!</h2>
              <p className="text-lg text-muted-foreground mb-8">Please verify your email to continue</p>

              <div className="bg-accent rounded-xl p-6 mb-8 border border-border">
                <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-sm text-accent-foreground mb-2">We&apos;ve sent a verification email to:</p>
                <p className="text-lg font-semibold text-foreground mb-4">{formValues.accountInfo?.email}</p>
                <p className="text-sm text-muted-foreground">
                  Please check your inbox and click the verification link to activate your account and schedule your screening.
                </p>
              </div>

              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-4">
                  Didn&apos;t receive the email? Check your spam folder or
                </p>
                <Button
                  onClick={handleResendEmail}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
                <p className="text-sm text-muted-foreground text-center">
                  <strong>Next:</strong> Verify your email → Schedule appointment → Get tested
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Drug Screening Registration</h1>
            <p className="text-muted-foreground">Complete your information to request a screening</p>
          </div>

          <ProgressBar />

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <div className="mt-8">
              {stepComponents[currentStep]}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <div className="flex flex-col items-start space-y-2">
                <Button
                  type="button"
                  onClick={handlePrevious}
                  variant="outline"
                  disabled={isFirstStep}
                  className={isFirstStep ? 'cursor-not-allowed opacity-50' : ''}
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Previous
                </Button>
              </div>

              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={handleNext}
                >
                  Next
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNext}
                  className={`bg-secondary hover:bg-secondary/90 text-secondary-foreground ${
                    isSubmitting ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    'Processing...'
                  ) : (
                    <>
                      Complete Registration
                      <Check className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
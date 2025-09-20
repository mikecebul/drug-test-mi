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

export const RegistrationFormSimple = () => {
  // Initialize state - start with default values for SSR
  const [currentStep, setCurrentStep] = useState(1)
  const [showVerification, setShowVerification] = useState(false)

  const totalSteps = 5

  const formOpts = useRegistrationFormOpts({
    setShowVerification,
  })
  const form = useAppForm({
    ...formOpts,
  })

  // Get form values for validation and display
  const formValues = useStore(form.store, (state) => state.values)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  const handleSubmit = () => {
    if (isStepValid()) {
      form.handleSubmit()
    }
  }
  const handleResendEmail = () => {
    console.log('Resending verification email to:', formValues.accountInfo?.email)
    toast.success(`Verification email resent to ${formValues.accountInfo?.email}`)
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return (
          formValues.personalInfo?.firstName &&
          formValues.personalInfo?.lastName &&
          formValues.personalInfo?.gender &&
          formValues.personalInfo?.dob &&
          formValues.personalInfo?.phone
        )
      case 2:
        return (
          formValues.accountInfo?.email &&
          formValues.accountInfo?.password &&
          formValues.accountInfo?.confirmPassword &&
          formValues.accountInfo.password === formValues.accountInfo.confirmPassword
        )
      case 3:
        return formValues.screeningRequest?.requestedBy
      case 4:
        return (
          formValues.resultsRecipient?.resultRecipientName &&
          formValues.resultsRecipient?.resultRecipientEmail
        )
      case 5:
        return formValues.termsAndConditions?.agreeToTerms
      default:
        return false
    }
  }

  const ProgressBar = () => (
    <div className="mb-8 w-full">
      <div className="mb-2 flex justify-between">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
              step <= currentStep
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {step < currentStep ? <Check className="h-5 w-5" /> : step}
          </div>
        ))}
      </div>
      <div className="relative">
        <div className="bg-border absolute inset-0 h-1 rounded-full"></div>
        <div
          className="bg-primary absolute h-1 rounded-full transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  )

  if (showVerification) {
    return (
      <div className="bg-background min-h-screen px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="bg-card border-border rounded-2xl border p-8 shadow-xl">
            <div className="text-center">
              <div className="bg-secondary/20 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                <CheckCircle className="text-secondary h-10 w-10" />
              </div>

              <h2 className="text-foreground mb-3 text-3xl font-bold">Registration Complete!</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Please verify your email to continue
              </p>

              <div className="bg-accent border-border mb-8 rounded-xl border p-6">
                <Mail className="text-primary mx-auto mb-3 h-8 w-8" />
                <p className="text-accent-foreground mb-2 text-sm">
                  We&apos;ve sent a verification email to:
                </p>
                <p className="text-foreground mb-4 text-lg font-semibold">
                  {formValues.accountInfo?.email}
                </p>
                <p className="text-muted-foreground text-sm">
                  Please check your inbox and click the verification link to activate your account
                  and schedule your screening.
                </p>
              </div>

              <div className="pt-6 border-t border-border">
                <p className="text-muted-foreground mb-4 text-sm">
                  Didn&apos;t receive the email? Check your spam folder or
                </p>
                <Button
                  onClick={handleResendEmail}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
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
    <div className="bg-background min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="bg-card border-border rounded-2xl border p-8 shadow-xl">
          <div className="mb-8 text-center">
            <h1 className="text-foreground mb-2 text-3xl font-bold">Drug Screening Registration</h1>
            <p className="text-muted-foreground">
              Complete your information to request a screening
            </p>
          </div>

          <ProgressBar />

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <div className="mt-8">
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <PersonalInfoGroup form={form} fields="personalInfo" title="Personal Information" />
              )}

              {/* Step 2: Account Information */}
              {currentStep === 2 && (
                <AccountInfoGroup form={form} fields="accountInfo" title="Account Info" />
              )}

              {/* Step 3: Screening Request */}
              {currentStep === 3 && (
                <ScreeningRequestGroup
                  form={form}
                  fields="screeningRequest"
                  title="Screening Request"
                />
              )}

              {/* Step 4: Results Recipient */}
              {currentStep === 4 && (
                <ResultsRecipientGroup
                  form={form}
                  fields="resultsRecipient"
                  title="Results Recipient"
                />
              )}

              {/* Step 5: Terms & Conditions */}
              {currentStep === 5 && (
                <TermsAndConditionsGroup
                  form={form}
                  fields="termsAndConditions"
                  title="Terms & Conditions"
                />
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              <Button
                type="button"
                onClick={prevStep}
                variant="outline"
                className={currentStep === 1 ? 'cursor-not-allowed opacity-50' : ''}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="mr-2 h-5 w-5" />
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className={!isStepValid() ? 'cursor-not-allowed opacity-50' : ''}
                  disabled={!isStepValid()}
                >
                  Next
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className={`bg-secondary hover:bg-secondary/90 text-secondary-foreground ${
                    !isStepValid() || isSubmitting ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                  disabled={!isStepValid() || isSubmitting}
                >
                  {isSubmitting ? (
                    'Processing...'
                  ) : (
                    <>
                      Complete Registration
                      <Check className="ml-2 h-5 w-5" />
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

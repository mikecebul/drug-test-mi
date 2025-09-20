'use client'

import React, { useState, useEffect, useCallback } from 'react'
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

// Debounce utility with flush support
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T & { flush: () => void } {
  let timeout: NodeJS.Timeout | null = null
  let lastArgs: any[] | null = null

  const debounced = ((...args: any[]) => {
    lastArgs = args
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T & { flush: () => void }

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    if (lastArgs) {
      func(...lastArgs)
      lastArgs = null
    }
  }

  return debounced
}

// Storage keys
const FORM_STATE_KEY = 'registration-form-state'
const CURRENT_STEP_KEY = 'registration-current-step'
const TIMESTAMP_KEY = 'registration-form-timestamp'

// Expiration time: 1 hour in milliseconds
const EXPIRATION_TIME = 60 * 60 * 1000

export const 
RegistrationForm = (props: any) => {
  const totalSteps = 5

  // Check if saved data is expired
  const isDataExpired = useCallback(() => {
    if (typeof window === 'undefined') return false

    const timestamp = localStorage.getItem(TIMESTAMP_KEY)
    if (!timestamp) return false

    const savedTime = parseInt(timestamp)
    const now = Date.now()
    return (now - savedTime) > EXPIRATION_TIME
  }, [])

  // Load saved state from localStorage
  const loadSavedState = useCallback(() => {
    if (typeof window === 'undefined') return null

    // Check if data is expired
    if (isDataExpired()) {
      // Clear expired data
      localStorage.removeItem(FORM_STATE_KEY)
      localStorage.removeItem(CURRENT_STEP_KEY)
      localStorage.removeItem(TIMESTAMP_KEY)
      return null
    }

    try {
      const saved = localStorage.getItem(FORM_STATE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Convert dob back to Date object if it exists
        if (parsed.values?.contactDetails?.dob && typeof parsed.values.contactDetails.dob === 'string') {
          parsed.values.contactDetails.dob = new Date(parsed.values.contactDetails.dob)
        }
        return parsed
      }
    } catch (error) {
      console.warn('Failed to load saved form state:', error)
    }
    return null
  }, [isDataExpired])

  // Load other saved states
  const loadCurrentStep = useCallback(() => {
    if (typeof window === 'undefined') return 1
    const saved = localStorage.getItem(CURRENT_STEP_KEY)
    return saved ? parseInt(saved, 10) : 1
  }, [])


  // Initialize state - start with default values for SSR
  const [currentStep, setCurrentStep] = useState(1)
  const [showVerification, setShowVerification] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Save state functions with localStorage
  const saveCurrentStep = useCallback((step: number) => {
    setCurrentStep(step)
    localStorage.setItem(CURRENT_STEP_KEY, step.toString())
  }, [])


  // Debounced save function for form state
  const saveFormState = useCallback(() => {
    return debounce((formState: any) => {
      try {
        localStorage.setItem(FORM_STATE_KEY, JSON.stringify(formState))
        localStorage.setItem(TIMESTAMP_KEY, Date.now().toString())
      } catch (error) {
        console.warn('Failed to save form state:', error)
      }
    }, 300)
  }, [])() // Immediately invoke to return the debounced function

  const formOpts = useRegistrationFormOpts({
    setShowVerification,
  })

  const form = useAppForm({
    ...formOpts,
  })

  // Restore saved state after hydration to avoid hydration mismatch
  useEffect(() => {
    setCurrentStep(loadCurrentStep())

    // Restore form state from localStorage after hydration
    const savedFormState = loadSavedState()
    if (savedFormState && savedFormState.values) {
      // Set each field value individually to ensure they're properly restored
      Object.entries(savedFormState.values).forEach(([fieldName, value]) => {
        const field = form.getFieldValue(fieldName as any)
        if (field !== value && value !== '') {
          form.setFieldValue(fieldName as any, value as any)
        }
      })
    }

    setIsHydrated(true)
  }, [loadCurrentStep, loadSavedState, form])

  // Add onChange listener to save form state (maintainer-suggested approach)
  useEffect(() => {
    const unsubscribe = form.store.subscribe(() => {
      saveFormState(form.state)
    })
    return unsubscribe
  }, [form.store, form.state, saveFormState])

  // Get form values for validation and display
  const formValues = useStore(form.store, (state) => state.values)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const fieldErrors = useStore(form.store, (state) => state.fieldMeta)

  const nextStep = () => {
    if (currentStep < totalSteps && isStepValid()) {
      // Save current form state immediately before changing step
      saveFormState.flush()
      saveCurrentStep(currentStep + 1)
    } else if (!isStepValid()) {
      toast.error('Please complete all required fields before continuing.')
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      // Save current form state immediately before changing step
      saveFormState.flush()
      saveCurrentStep(currentStep - 1)
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


  const clearFormDataWithUndo = () => {
    // Save current state for undo
    const currentFormState = JSON.parse(JSON.stringify(form.state.values))
    const currentStepState = currentStep
    const currentVerificationState = showVerification

    // Immediately reset the form UI
    form.reset()
    saveCurrentStep(1)
    setShowVerification(false)

    let countdown = 5
    let countdownInterval: NodeJS.Timeout

    const restoreData = () => {
      clearInterval(countdownInterval)

      // Restore form values
      Object.entries(currentFormState).forEach(([groupName, groupData]: [string, any]) => {
        if (typeof groupData === 'object' && groupData !== null) {
          Object.entries(groupData).forEach(([fieldName, value]) => {
            form.setFieldValue(`${groupName}.${fieldName}` as any, value as any)
          })
        }
      })

      // Restore other states
      saveCurrentStep(currentStepState)
      setShowVerification(currentVerificationState)

      toast.success('Form data restored')
    }

    // Create a single toast that we'll update
    const toastId = toast(`Form data cleared - Undo in ${countdown}s`, {
      duration: Infinity, // Keep it open until we manually dismiss it
      action: {
        label: 'Undo',
        onClick: restoreData,
      },
    })

    // Update countdown every second
    countdownInterval = setInterval(() => {
      countdown--
      if (countdown > 0) {
        // Update the existing toast
        toast(`Form data cleared - Undo in ${countdown}s`, {
          id: toastId,
          duration: Infinity,
          action: {
            label: 'Undo',
            onClick: restoreData,
          },
        })
      } else {
        // Time's up - dismiss the toast and clear localStorage
        clearInterval(countdownInterval)
        toast.dismiss(toastId)

        localStorage.removeItem(FORM_STATE_KEY)
        localStorage.removeItem(CURRENT_STEP_KEY)
        localStorage.removeItem(TIMESTAMP_KEY)

        toast.info('Form data permanently cleared')
      }
    }, 1000)
  }

  const isStepValid = () => {
    const getFieldErrors = (fieldName: string) => {
      return fieldErrors[fieldName]?.errors || []
    }

    const hasValue = (value: any) => {
      return value !== undefined && value !== null && value !== ''
    }

    switch (currentStep) {
      case 1:
        // Check if all required fields have values and no validation errors
        const personalFields = [
          'personalInfo.firstName',
          'personalInfo.lastName',
          'personalInfo.gender',
          'personalInfo.dob',
          'personalInfo.phone'
        ]
        return personalFields.every(field => {
          const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], formValues)
          return hasValue(fieldValue) && getFieldErrors(field).length === 0
        })

      case 2:
        // Check account info fields including async email validation
        const accountFields = [
          'accountInfo.email',
          'accountInfo.password',
          'accountInfo.confirmPassword'
        ]
        const accountFieldsValid = accountFields.every(field => {
          const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], formValues)
          return hasValue(fieldValue) && getFieldErrors(field).length === 0
        })
        // Also check password match
        const passwordsMatch = formValues.accountInfo?.password === formValues.accountInfo?.confirmPassword
        return accountFieldsValid && passwordsMatch

      case 3:
        return hasValue(formValues.screeningRequest?.requestedBy) &&
               getFieldErrors('screeningRequest.requestedBy').length === 0

      case 4:
        // Dynamic validation based on requestedBy value
        const requestedBy = formValues.screeningRequest?.requestedBy
        let recipientFields: string[] = []

        if (requestedBy === 'self') {
          const useSelfAsRecipient = formValues.resultsRecipient?.useSelfAsRecipient
          if (useSelfAsRecipient === false) {
            recipientFields = [
              'resultsRecipient.alternativeRecipientName',
              'resultsRecipient.alternativeRecipientEmail'
            ]
          }
          // If useSelfAsRecipient is true, no additional validation needed
        } else if (requestedBy === 'employment') {
          recipientFields = [
            'resultsRecipient.employerName',
            'resultsRecipient.contactName',
            'resultsRecipient.contactEmail'
          ]
        } else if (requestedBy === 'probation') {
          recipientFields = [
            'resultsRecipient.courtName',
            'resultsRecipient.probationOfficerName',
            'resultsRecipient.probationOfficerEmail'
          ]
        }

        return recipientFields.every(field => {
          const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], formValues)
          return hasValue(fieldValue) && getFieldErrors(field).length === 0
        })

      case 5:
        return formValues.termsAndConditions?.agreeToTerms === true &&
               getFieldErrors('termsAndConditions.agreeToTerms').length === 0

      default:
        return false
    }
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
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  )

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
    )  }

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
                <ScreeningRequestGroup form={form} fields="screeningRequest" title="Screening Request" />
              )}

              {/* Step 4: Results Recipient */}
              {currentStep === 4 && (
                <ResultsRecipientGroup
                  form={form}
                  fields="resultsRecipient"
                  title="Results Recipient"
                  requestedBy={formValues.screeningRequest?.requestedBy || ''}
                />
              )}

              {/* Step 5: Terms & Conditions */}
              {currentStep === 5 && (
                <TermsAndConditionsGroup form={form} fields="termsAndConditions" title="Terms & Conditions" />
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <div className="flex flex-col items-start space-y-2">
                <Button
                  type="button"
                  onClick={prevStep}
                  variant="outline"
                  className={
                    currentStep === 1
                      ? 'cursor-not-allowed opacity-50'
                      : ''
                  }
                  disabled={currentStep === 1}
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Previous
                </Button>

                {/* Clear form button - small text below Previous */}
                {isHydrated && (localStorage.getItem(FORM_STATE_KEY) || currentStep > 1) && (
                  <button
                    type="button"
                    onClick={clearFormDataWithUndo}
                    className="text-xs text-muted-foreground hover:text-destructive underline"
                  >
                    Clear Form
                  </button>
                )}
              </div>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className={
                    !isStepValid()
                      ? 'cursor-not-allowed opacity-50'
                      : ''
                  }
                  disabled={!isStepValid()}
                >
                  Next
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className={`bg-secondary hover:bg-secondary/90 text-secondary-foreground ${
                    !isStepValid() || isSubmitting
                      ? 'cursor-not-allowed opacity-50'
                      : ''
                  }`}
                  disabled={!isStepValid() || isSubmitting}
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
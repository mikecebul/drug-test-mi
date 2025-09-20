'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { Dispatch, SetStateAction } from 'react'

// Import the field group types
export type PersonalInfoFields = {
  firstName: string
  lastName: string
  gender: string
  dob: Date | string
  phone: string
}

export type AccountInfoFields = {
  email: string
  password: string
  confirmPassword: string
}

export type ScreeningRequestFields = {
  requestedBy: 'probation' | 'employment' | 'self' | ''
}

export type ResultsRecipientFields = {
  resultRecipientName: string
  resultRecipientEmail: string
}

export type TermsAndConditionsFields = {
  agreeToTerms: boolean
}

export type RegistrationFormType = {
  personalInfo: PersonalInfoFields
  accountInfo: AccountInfoFields
  screeningRequest: ScreeningRequestFields
  resultsRecipient: ResultsRecipientFields
  termsAndConditions: TermsAndConditionsFields
}

const defaultValues: RegistrationFormType = {
  personalInfo: {
    firstName: '',
    lastName: '',
    gender: '',
    dob: '',
    phone: '',
  },
  accountInfo: {
    email: '',
    password: '',
    confirmPassword: '',
  },
  screeningRequest: {
    requestedBy: '',
  },
  resultsRecipient: {
    resultRecipientName: '',
    resultRecipientEmail: '',
  },
  termsAndConditions: {
    agreeToTerms: false,
  },
}

export const useRegistrationFormOpts = ({
  setShowVerification,
}: {
  setShowVerification: Dispatch<SetStateAction<boolean>>
}) => {
  return formOptions({
    defaultValues: defaultValues,
    onSubmit: async ({ value }: { value: RegistrationFormType }) => {
      try {
        // Create the client account via Payload API
        // Validate password confirmation
        if (value.accountInfo.password !== value.accountInfo.confirmPassword) {
          throw new Error('Passwords do not match')
        }

        // Build payload based on selected client type
        const clientType = value.screeningRequest.requestedBy as 'probation' | 'employment' | 'self'

        const payload: any = {
          name: `${value.personalInfo.firstName} ${value.personalInfo.lastName}`,
          email: value.accountInfo.email,
          phone: value.personalInfo.phone,
          password: value.accountInfo.password,
          clientType,
          preferredContactMethod: 'email',
        }

        // Add type-specific information for employment and probation
        if (clientType === 'employment') {
          payload.employmentInfo = {
            employerName: value.resultsRecipient.resultRecipientName, // Use recipient as employer
            contactName: value.resultsRecipient.resultRecipientName,
            contactEmail: value.resultsRecipient.resultRecipientEmail,
          }
        } else if (clientType === 'probation') {
          payload.courtInfo = {
            courtName: value.resultsRecipient.resultRecipientName, // Use recipient as court
            probationOfficerName: value.resultsRecipient.resultRecipientName,
            probationOfficerEmail: value.resultsRecipient.resultRecipientEmail,
          }
        }
        // For 'self' type, no additional info needed

        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.errors?.[0]?.message || 'Registration failed')
        }

        console.log('Registration successful:', result)

        // Clear localStorage after successful submission
        localStorage.removeItem('registration-form-state')
        localStorage.removeItem('registration-current-step')
        localStorage.removeItem('registration-form-timestamp')

        toast.success('Registration submitted successfully! Please check your email to verify your account.')
        setShowVerification(true)
      } catch (error) {
        console.error('Registration error:', error)
        toast.error(error instanceof Error ? error.message : 'Registration failed. Please try again.')
        throw error
      }
    },
  })
}

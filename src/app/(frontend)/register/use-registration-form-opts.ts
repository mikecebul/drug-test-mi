'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import type { Dispatch, SetStateAction } from 'react'
import type { RegistrationFormType } from './schemas/registrationSchemas'
import { Client } from '@/payload-types'

const defaultValues: RegistrationFormType = {
  personalInfo: {
    firstName: '',
    lastName: '',
    gender: '',
    dob: new Date(0),
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
    useSelfAsRecipient: true,
    alternativeRecipientName: '',
    alternativeRecipientEmail: '',
    employerName: '',
    contactName: '',
    contactEmail: '',
    courtName: '',
    probationOfficerName: '',
    probationOfficerEmail: '',
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
    onSubmit: async ({ value, formApi }: { value: RegistrationFormType; formApi: any }) => {
      try {
        // Create the client account via Payload API
        // Validate password confirmation
        if (value.accountInfo.password !== value.accountInfo.confirmPassword) {
          throw new Error('Passwords do not match')
        }

        // Build payload based on selected client type
        const clientType = value.screeningRequest.requestedBy

        const payload: any = {
          name: `${value.personalInfo.firstName} ${value.personalInfo.lastName}`, // Keep for migration
          firstName: value.personalInfo.firstName,
          lastName: value.personalInfo.lastName,
          dateOfBirth: value.personalInfo.dob,
          gender: value.personalInfo.gender,
          email: value.accountInfo.email,
          phone: value.personalInfo.phone,
          password: value.accountInfo.password,
          clientType: clientType,
          preferredContactMethod: 'email',
        }

        // Add type-specific information for employment and probation
        if (clientType === 'employment') {
          payload.employmentInfo = {
            employerName: value.resultsRecipient.employerName,
            contactName: value.resultsRecipient.contactName,
            contactEmail: value.resultsRecipient.contactEmail,
          }
        } else if (clientType === 'probation') {
          payload.courtInfo = {
            courtName: value.resultsRecipient.courtName,
            probationOfficerName: value.resultsRecipient.probationOfficerName,
            probationOfficerEmail: value.resultsRecipient.probationOfficerEmail,
          }
        } else if (clientType === 'self' && !value.resultsRecipient.useSelfAsRecipient) {
          // Add alternative recipient info for self-pay clients
          payload.alternativeRecipient = {
            name: value.resultsRecipient.alternativeRecipientName,
            email: value.resultsRecipient.alternativeRecipientEmail,
          }
        }

        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.errors?.[0]?.message || 'Registration failed')
        }

        formApi.reset()

        toast.success(
          'Registration submitted successfully! Please check your email to verify your account.',
        )
        setShowVerification(true)
      } catch (error) {
        console.error('Registration error:', error)
        toast.error(
          error instanceof Error ? error.message : 'Registration failed. Please try again.',
        )
        throw error
      }
    },
  })
}

export { defaultValues }

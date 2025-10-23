'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import type { Dispatch, SetStateAction } from 'react'
import type { RegistrationFormType } from './schemas/registrationSchemas'
import {
  COURT_CONFIGS,
  EMPLOYER_CONFIGS,
  isValidEmployerType,
  isValidCourtType
} from './configs/recipient-configs'

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
    useSelfAsRecipient: true,
    alternativeRecipientName: '',
    alternativeRecipientEmail: '',
    selectedEmployer: '',
    employerName: '',
    contactName: '',
    contactEmail: '',
    selectedCourt: '',
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
          dob: value.personalInfo.dob instanceof Date
            ? value.personalInfo.dob.toISOString().split('T')[0]
            : value.personalInfo.dob,
          gender: value.personalInfo.gender,
          email: value.accountInfo.email,
          phone: value.personalInfo.phone,
          password: value.accountInfo.password,
          clientType: clientType,
          preferredContactMethod: 'email',
        }

        // Add type-specific information for employment and probation
        if (clientType === 'employment') {
          const selectedEmployer = value.resultsRecipient.selectedEmployer
          let employerName = ''
          let recipients: Array<{ name: string; email: string }> = []

          // Runtime validation with type guard
          if (isValidEmployerType(selectedEmployer)) {
            const employerConfig = EMPLOYER_CONFIGS[selectedEmployer]
            employerName = employerConfig.label

            // Handle pre-configured employers with recipients array
            if ('recipients' in employerConfig && employerConfig.recipients.length > 0) {
              recipients = [...employerConfig.recipients]
            }
            // Handle "Other" employer - manual entry
            else if (selectedEmployer === 'other') {
              employerName = value.resultsRecipient.employerName || ''
              recipients = [
                {
                  name: value.resultsRecipient.contactName || '',
                  email: value.resultsRecipient.contactEmail || '',
                },
              ]
            }
          } else {
            throw new Error('Invalid employer selection')
          }

          // Validate that recipients were populated
          if (recipients.length === 0) {
            console.error('Registration failed: No recipients for employer', {
              selectedEmployer,
              employerName
            })
            throw new Error('No recipients configured for employer. Please contact support.')
          }

          payload.employmentInfo = {
            employerName,
            recipients,
          }
        } else if (clientType === 'probation') {
          const selectedCourt = value.resultsRecipient.selectedCourt
          let courtName = ''
          let recipients: Array<{ name: string; email: string }> = []

          // Runtime validation with type guard
          if (isValidCourtType(selectedCourt)) {
            const courtConfig = COURT_CONFIGS[selectedCourt]
            courtName = courtConfig.label

            // Handle pre-configured courts with recipients array
            if (courtConfig.recipients.length > 0) {
              recipients = [...courtConfig.recipients]
            }
            // Handle "Other" court - manual entry
            else if (selectedCourt === 'other') {
              courtName = value.resultsRecipient.courtName || ''
              recipients = [
                {
                  name: value.resultsRecipient.probationOfficerName || '',
                  email: value.resultsRecipient.probationOfficerEmail || '',
                },
              ]
            }
          } else {
            throw new Error('Invalid court selection')
          }

          // Validate that recipients were populated
          if (recipients.length === 0) {
            console.error('Registration failed: No recipients for court', {
              selectedCourt,
              courtName
            })
            throw new Error('No recipients configured for court. Please contact support.')
          }

          payload.courtInfo = {
            courtName,
            recipients,
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
          // Log detailed error information for debugging
          console.error('Registration failed', {
            status: response.status,
            email: payload.email,
            clientType: payload.clientType,
            error: result
          })

          // Provide helpful error messages for common cases
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

        formApi.reset()

        toast.success(
          'Registration submitted successfully! Please check your email to verify your account.',
        )
        setShowVerification(true)
      } catch (error) {
        console.error('Registration error:', error)

        // Only show toast if we haven't already shown one
        if (error instanceof Error && !error.message.includes('already exists') &&
            !error.message.includes('Server error') && !error.message.includes('check your information')) {
          toast.error(
            error instanceof Error ? error.message : 'Registration failed. Please try again.',
          )
        }
        throw error
      }
    },
  })
}

export { defaultValues }

'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import type { Dispatch, SetStateAction } from 'react'
import type { RegistrationFormType } from './schemas/registrationSchemas'
import { Client } from '@/payload-types'
import { COURT_CONFIGS } from './field-groups/ResultsRecipientGroup'

type CourtType = keyof typeof COURT_CONFIGS

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
    employerName: '',
    contactName: '',
    contactEmail: '',
    selectedCourt: '',
    selectedCircuitOfficer: '',
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
          payload.employmentInfo = {
            employerName: value.resultsRecipient.employerName,
            contactName: value.resultsRecipient.contactName,
            contactEmail: value.resultsRecipient.contactEmail,
          }
        } else if (clientType === 'probation') {
          const selectedCourt = value.resultsRecipient.selectedCourt as CourtType
          let courtName = ''
          let recipients: Array<{ name: string; email: string }> = []

          console.log('📋 Court Registration Debug:', {
            selectedCourt,
            selectedCircuitOfficer: value.resultsRecipient.selectedCircuitOfficer,
            courtName: value.resultsRecipient.courtName,
            probationOfficerName: value.resultsRecipient.probationOfficerName,
            probationOfficerEmail: value.resultsRecipient.probationOfficerEmail,
          })

          if (selectedCourt && COURT_CONFIGS[selectedCourt]) {
            const courtConfig = COURT_CONFIGS[selectedCourt]
            courtName = courtConfig.label

            // Handle Charlevoix Circuit Court - only selected officer
            if (selectedCourt === 'charlevoix-circuit') {
              if (value.resultsRecipient.selectedCircuitOfficer && 'officers' in courtConfig) {
                const selectedOfficer = courtConfig.officers.find(
                  (o) => o.email === value.resultsRecipient.selectedCircuitOfficer
                )
                console.log('🏛️ Circuit Court - Selected Officer:', selectedOfficer)
                if (selectedOfficer) {
                  recipients = [selectedOfficer]
                }
              }
            }
            // Handle pre-configured courts with recipients array
            else if ('recipients' in courtConfig && courtConfig.recipients.length > 0) {
              recipients = [...courtConfig.recipients]
              console.log('📧 Pre-configured recipients:', recipients)
            }
            // Handle "Other" or courts without pre-configured recipients
            else if (selectedCourt === 'other') {
              courtName = value.resultsRecipient.courtName || ''
              recipients = [
                {
                  name: value.resultsRecipient.probationOfficerName || '',
                  email: value.resultsRecipient.probationOfficerEmail || '',
                },
              ]
              console.log('✏️ Manual entry recipients:', recipients)
            }
          }

          console.log('✅ Final courtInfo payload:', { courtName, recipients })

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

        console.log('🚀 Sending payload to /api/clients:', JSON.stringify(payload, null, 2))
        console.log('🔍 courtInfo details:', {
          courtName: payload.courtInfo?.courtName,
          recipients: payload.courtInfo?.recipients,
          recipientsLength: payload.courtInfo?.recipients?.length,
        })

        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        console.log('📥 Server response:', result)

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

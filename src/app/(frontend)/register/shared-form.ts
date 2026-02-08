'use client'

import { formOptions } from '@tanstack/react-form'
import z from 'zod'
import { checkEmailExists } from './actions'
import {
  personalInfoSchema,
  accountInfoSchema,
  screeningTypeSchema,
  recipientsSchema,
  medicationsSchema,
  termsSchema,
  formSchema,
  type FormValues,
  type Steps,
} from './validators'

const defaultValues: FormValues = {
  personalInfo: {
    firstName: '',
    lastName: '',
    middleInitial: '',
    gender: '',
    dob: '',
    phone: '',
    headshot: null,
  },
  accountInfo: {
    email: '',
    password: '',
    confirmPassword: '',
  },
  screeningType: {
    requestedBy: '' as FormValues['screeningType']['requestedBy'],
  },
  recipients: {
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
  medications: [] as FormValues['medications'],
  terms: {
    agreeToTerms: false as FormValues['terms']['agreeToTerms'],
  },
}

export const registerClientFormOpts = formOptions({
  defaultValues,
})

export const getRegisterClientFormOpts = (step: Steps[number]) =>
  formOptions({
    defaultValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (step !== 'accountInfo') return undefined
        const email = value.accountInfo.email
        if (!email || !z.email().safeParse(email).success) {
          return undefined
        }
        try {
          const emailExists = await checkEmailExists(email)
          if (emailExists) {
            return {
              fields: {
                'accountInfo.email': 'An account with this email already exists',
              },
            }
          }
        } catch (error) {
          console.warn('Failed to check email existence:', error)
        }
        return undefined
      },
      onSubmit: ({ formApi }) => {
        if (step === 'personalInfo') {
          return formApi.parseValuesWithSchema(personalInfoSchema as typeof formSchema)
        }
        if (step === 'accountInfo') {
          return formApi.parseValuesWithSchema(accountInfoSchema as typeof formSchema)
        }
        if (step === 'screeningType') {
          return formApi.parseValuesWithSchema(screeningTypeSchema as typeof formSchema)
        }
        if (step === 'recipients') {
          return formApi.parseValuesWithSchema(recipientsSchema as typeof formSchema)
        }
        if (step === 'medications') {
          return formApi.parseValuesWithSchema(medicationsSchema as typeof formSchema)
        }
        if (step === 'terms') {
          return formApi.parseValuesWithSchema(termsSchema as typeof formSchema)
        }
        return undefined
      },
    },
  })

export { defaultValues }

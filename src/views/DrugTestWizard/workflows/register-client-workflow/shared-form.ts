import { formOptions } from '@tanstack/react-form'
import {
  personalInfoSchema,
  accountInfoSchema,
  screeningTypeSchema,
  recipientsSchema,
  termsSchema,
  formSchema,
  type FormValues,
  type Steps,
} from './validators'
import z from 'zod'
import { checkEmailExists } from '@/app/(frontend)/register/actions'
import { safeServerAction } from '@/lib/actions/safeServerAction'

// Generate secure password (duplicated from RegisterClientDialog)
function generatePassword(): string {
  const length = 12
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'
  const numbers = '23456789'

  let password = ''
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]

  const all = uppercase + lowercase + numbers
  for (let i = 3; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)]
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

// Generate password once for the session
const generatedPassword = generatePassword()

// Default values with auto-generated password
const defaultValues: FormValues = {
  personalInfo: {
    firstName: '',
    lastName: '',
    middleInitial: '',
    gender: '',
    dob: '',
    phone: '',
  },
  accountInfo: {
    noEmail: false,
    email: '',
    password: generatedPassword,
    confirmPassword: generatedPassword,
  },
  screeningType: {
    requestedBy: '',
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
  terms: {
    agreeToTerms: true, // Auto-agree for admin registration
  },
}

// Basic form opts for components (e.g., Navigation)
export const registerClientFormOpts = formOptions({
  defaultValues,
})

// Step-aware form options for Workflow
export const getRegisterClientFormOpts = (step: Steps[number]) =>
  formOptions({
    defaultValues,
    // validationLogic: revalidateLogic(),
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (step === 'accountInfo') {
          if (value.accountInfo.noEmail) {
            return undefined
          }

          const email = value.accountInfo.email
          if (!email || !z.email().safeParse(email).success) {
            return undefined // Skip validation if email is empty or invalid format
          }
          try {
            const emailExists = await safeServerAction(() => checkEmailExists(email))
            if (emailExists) {
              return {
                fields: {
                  'accountInfo.email': 'An account with this email already exists',
                },
                // 'accountInfo.email': 'An account with this email already exists',
              }
              // return 'An account with this email already exists'
              // return {
              //   message: 'An account with this email already exists',
              //   path: 'accountInfo.email',
              // }
            }
          } catch (error) {
            console.warn('Failed to check email existence:', error)
            // Don't block registration if the check fails
          }
          return undefined
        }
      },
      onSubmit: ({ formApi }) => {
        if (step === 'personalInfo') {
          return formApi.parseValuesWithSchema(personalInfoSchema as typeof formSchema)
        }
        if (step === 'accountInfo') {
          if (formApi.state.values.accountInfo.noEmail) {
            return undefined
          }

          return formApi.parseValuesWithSchema(accountInfoSchema as typeof formSchema)
        }
        if (step === 'screeningType') {
          return formApi.parseValuesWithSchema(screeningTypeSchema as typeof formSchema)
        }
        if (step === 'recipients') {
          return formApi.parseValuesWithSchema(recipientsSchema as typeof formSchema)
        }
        if (step === 'terms') {
          return formApi.parseValuesWithSchema(termsSchema as typeof formSchema)
        }
        return undefined
      },
    },
  })

// Export generated password for use in Success screen
export { generatedPassword }

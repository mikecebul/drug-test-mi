import { formOptions, revalidateLogic } from '@tanstack/react-form'
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
    gender: '',
    dob: '',
    phone: '',
  },
  accountInfo: {
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
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: ({ formApi }) => {
        if (step === 'personalInfo') {
          console.log('Validating personal info schema:', formApi.getFieldValue('personalInfo.dob'))
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
        if (step === 'terms') {
          return formApi.parseValuesWithSchema(termsSchema as typeof formSchema)
        }
        return undefined
      },
      onSubmitAsync: async ({ value }) => {
        if (step === 'accountInfo') {
          const email = value.accountInfo.email
          if (!email || !z.email().safeParse(email).success) {
            return undefined // Skip validation if email is empty or invalid format
          }
          try {
            const emailExists = await checkEmailExists(email)
            if (emailExists) {
              return 'An account with this email already exists'
            }
          } catch (error) {
            console.warn('Failed to check email existence:', error)
            // Don't block registration if the check fails
          }
          return undefined
        }
      },
      // onDynamicSubmit: ({ formApi }) => {
      //   if (step === 'personalInfo') {
      //     return formApi.parseValuesWithSchema(personalInfoSchema as typeof formSchema)
      //   }
      //   if (step === 'accountInfo') {
      //     return formApi.parseValuesWithSchema(accountInfoSchema as typeof formSchema)
      //   }
      //   if (step === 'screeningType') {
      //     return formApi.parseValuesWithSchema(screeningTypeSchema as typeof formSchema)
      //   }
      //   if (step === 'recipients') {
      //     return formApi.parseValuesWithSchema(recipientsSchema as typeof formSchema)
      //   }
      //   if (step === 'terms') {
      //     return formApi.parseValuesWithSchema(termsSchema as typeof formSchema)
      //   }
      //   return undefined
      // },
    },
  })

// Export generated password for use in Success screen
export { generatedPassword }

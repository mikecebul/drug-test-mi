import { formOptions } from '@tanstack/react-form'
import { type FormValues, type Steps } from './validators'

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
    additionalReferralRecipients: [],
    selectedEmployer: '',
    otherEmployerName: '',
    otherEmployerMainContactName: '',
    otherEmployerMainContactEmail: '',
    otherEmployerRecipientEmails: '',
    otherEmployerAdditionalRecipients: [],
    selectedCourt: '',
    otherCourtName: '',
    otherCourtMainContactName: '',
    otherCourtMainContactEmail: '',
    otherCourtRecipientEmails: '',
    otherCourtAdditionalRecipients: [],
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
export const getRegisterClientFormOpts = (_step: Steps[number]) =>
  formOptions({
    defaultValues,
  })

// Export generated password for use in Success screen
export { generatedPassword }

// export interface PersonalInfoFields {
//   firstName: string
//   lastName: string
//   gender: string
// }

// export interface ContactDetailsFields {
//   dob: Date | undefined
//   email: string
//   phone: string
// }

// export interface ScreeningRequestFields {
//   requestedBy: string
// }

// export interface ResultsRecipientFields {
//   resultRecipientName: string
//   resultRecipientEmail: string
// }

// export interface TermsAndConditionsFields {
//   agreeToTerms: boolean
// }

// export interface RegistrationFormData
//   extends PersonalInfoFields,
//     ContactDetailsFields,
//     ScreeningRequestFields,
//     ResultsRecipientFields,
//     TermsAndConditionsFields {}

// export const defaultValues: RegistrationFormData = {
//   firstName: '',
//   lastName: '',
//   gender: '',
//   dob: undefined,
//   email: '',
//   phone: '',
//   requestedBy: '',
//   resultRecipientName: '',
//   resultRecipientEmail: '',
//   agreeToTerms: false,
// }

export const SCREENING_TYPES = [
  {
    value: 'court',
    label: 'Court',
    description: 'Court or probation referral',
  },
  {
    value: 'employer',
    label: 'Employer',
    description: 'Pre-employment or workplace referral',
  },
  {
    value: 'self',
    label: 'Self',
    description: 'Personal request for screening',
  },
] as const

export { CLIENT_GENDER_OPTIONS as GENDER_OPTIONS } from '@/lib/client-gender'

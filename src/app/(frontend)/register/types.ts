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
    value: 'probation',
    label: 'Probation',
    description: 'Required by probation officer',
  },
  {
    value: 'employment',
    label: 'Employment',
    description: 'Pre-employment or workplace screening',
  },
  {
    value: 'self',
    label: 'Self',
    description: 'Personal request for screening',
  },
] as const

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
]
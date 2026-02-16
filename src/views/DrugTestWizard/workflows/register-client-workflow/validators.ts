import { z } from 'zod'

export const personalInfoFieldSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required' }),
  lastName: z.string().min(1, { error: 'Last name is required' }),
  middleInitial: z.string().max(1, { error: 'Middle initial must be a single character' }).optional(),
  gender: z.string().min(1, { error: 'Please select a gender' }),
  dob: z.union([
    z.string().min(1, { error: 'Date of birth is required' }),
    z.date({ error: 'Date of birth is required' }),
  ])
    .refine((val) => {
      const date = typeof val === 'string' ? new Date(val) : val
      if (isNaN(date.getTime())) return false
      const year = date.getFullYear()
      const currentYear = new Date().getFullYear()
      return year >= 1900 && year <= currentYear
    }, {
      message: 'Please enter a valid date',
    })
    .refine((val) => {
      const date = typeof val === 'string' ? new Date(val) : val
      const thirteenYearsAgo = new Date()
      thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13)
      return date <= thirteenYearsAgo
    }, {
      message: 'You must be at least 13 years old',
    }),
  phone: z
    .string()
    .min(1, { error: 'Phone number is required' })
    .regex(/^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, {
      error: 'Please enter a valid phone number',
    }),
  headshot: z.instanceof(File).optional().nullable(),
})

export const accountInfoFieldSchema = z.object({
  noEmail: z.boolean().optional(),
  email: z
    .string()
    .min(1, { error: 'Email is required' })
    .pipe(z.email({ error: 'Please enter a valid email address' })),
  password: z
    .string()
    .min(8, { error: 'Password must be at least 8 characters' })
    .regex(/[A-Z]/, { error: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { error: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { error: 'Password must contain at least one number' }),
  confirmPassword: z.string().min(1, { error: 'Please confirm your password' }),
})

export const screeningRequestFieldSchema = z.object({
  requestedBy: z.enum(['probation', 'employment', 'self', ''], {
    error: 'Please select who is requesting this screening',
  }).refine((val) => val !== '', {
    error: 'Please select who is requesting this screening',
  }),
})

export const termsAndConditionsFieldSchema = z.object({
  agreeToTerms: z.boolean().refine((val) => val === true, {
    error: 'You must agree to the terms and conditions',
  }),
})

// Define step names for the workflow
export const steps = [
  'personalInfo',
  'accountInfo',
  'screeningType',
  'recipients',
  'terms',
] as const

export type Steps = typeof steps

// Step 1: Personal Information
export const personalInfoSchema = z.object({
  personalInfo: personalInfoFieldSchema,
})

// Step 2: Account Information with password confirmation
export const accountInfoSchema = z
  .object({
    accountInfo: accountInfoFieldSchema,
  })
  .refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
    message: "Passwords don't match",
    path: ['accountInfo', 'confirmPassword'],
  })

// Step 3: Screening Type
export const screeningTypeSchema = z.object({
  screeningType: screeningRequestFieldSchema,
})

// Step 4: Recipients (conditional validation based on screening type)
export const recipientsSchema = z
  .object({
    recipients: z.object({
      // Self-pay recipient fields
      useSelfAsRecipient: z.boolean().optional(),
      alternativeRecipientName: z.string().optional(),
      alternativeRecipientEmail: z.union([z.string().email(), z.literal('')]).optional(),

      // Employment recipient fields
      selectedEmployer: z.string().optional(),
      employerName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.union([z.string().email(), z.literal('')]).optional(),

      // Probation/Court recipient fields
      selectedCourt: z.string().optional(),
      courtName: z.string().optional(),
      probationOfficerName: z.string().optional(),
      probationOfficerEmail: z.union([z.string().email(), z.literal('')]).optional(),
    }),
    screeningType: z.object({
      requestedBy: z.enum(['self', 'employment', 'probation']),
    }),
  })
  .superRefine((data, ctx) => {
    const { recipients, screeningType } = data
    const { requestedBy } = screeningType

    // Conditional validation based on screening type
    if (requestedBy === 'self') {
      if (recipients.useSelfAsRecipient === false) {
        if (!recipients.alternativeRecipientName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Recipient name is required',
            path: ['recipients', 'alternativeRecipientName'],
          })
        }
        if (!recipients.alternativeRecipientEmail) {
          ctx.addIssue({
            code: 'custom',
            message: 'Recipient email is required',
            path: ['recipients', 'alternativeRecipientEmail'],
          })
        }
      }
    } else if (requestedBy === 'employment') {
      if (!recipients.selectedEmployer) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please select an employer',
          path: ['recipients', 'selectedEmployer'],
        })
      }

      // "Other" employer requires manual entry
      if (recipients.selectedEmployer === 'other') {
        if (!recipients.employerName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Employer name is required',
            path: ['recipients', 'employerName'],
          })
        }
        if (!recipients.contactName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Contact name is required',
            path: ['recipients', 'contactName'],
          })
        }
        if (!recipients.contactEmail) {
          ctx.addIssue({
            code: 'custom',
            message: 'Contact email is required',
            path: ['recipients', 'contactEmail'],
          })
        }
      }
    } else if (requestedBy === 'probation') {
      if (!recipients.selectedCourt) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please select a court',
          path: ['recipients', 'selectedCourt'],
        })
      }

      // "Other" court requires manual entry
      if (recipients.selectedCourt === 'other') {
        if (!recipients.courtName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Court name is required',
            path: ['recipients', 'courtName'],
          })
        }
        if (!recipients.probationOfficerName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Probation officer name is required',
            path: ['recipients', 'probationOfficerName'],
          })
        }
        if (!recipients.probationOfficerEmail) {
          ctx.addIssue({
            code: 'custom',
            message: 'Probation officer email is required',
            path: ['recipients', 'probationOfficerEmail'],
          })
        }
      }
    }
  })

// Step 5: Terms and Conditions
export const termsSchema = z.object({
  terms: termsAndConditionsFieldSchema,
})

// Complete form schema
export const formSchema = z.object({
  personalInfo: personalInfoSchema.shape.personalInfo,
  accountInfo: accountInfoSchema.shape.accountInfo,
  screeningType: screeningTypeSchema.shape.screeningType,
  recipients: recipientsSchema.shape.recipients,
  terms: termsSchema.shape.terms,
})
.refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
  message: "Passwords don't match",
  path: ['accountInfo', 'confirmPassword'],
})

// Type inference
export type FormValues = z.infer<typeof formSchema>

export const stepSchemas = [
  personalInfoSchema,
  accountInfoSchema,
  screeningTypeSchema,
  recipientsSchema,
  termsSchema,
]

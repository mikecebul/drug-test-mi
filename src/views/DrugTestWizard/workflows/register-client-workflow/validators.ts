import { z } from 'zod'

const recipientRowSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
})

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
  requestedBy: z.enum(['court', 'employer', 'self', ''], {
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

export const steps = [
  'personalInfo',
  'accountInfo',
  'screeningType',
  'recipients',
  'terms',
] as const

export type Steps = typeof steps

export const personalInfoSchema = z.object({
  personalInfo: personalInfoFieldSchema,
})

export const accountInfoSchema = z
  .object({
    accountInfo: accountInfoFieldSchema,
  })
  .refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
    message: "Passwords don't match",
    path: ['accountInfo', 'confirmPassword'],
  })

export const screeningTypeSchema = z.object({
  screeningType: screeningRequestFieldSchema,
})

export const recipientsSchema = z
  .object({
    recipients: z.object({
      sendToOther: z.boolean().optional(),
      selfRecipients: z.array(recipientRowSchema).optional(),

      selectedEmployer: z.string().optional(),
      otherEmployerName: z.string().optional(),
      otherEmployerMainContactName: z.string().optional(),
      otherEmployerMainContactEmail: z.union([z.string().email(), z.literal('')]).optional(),
      otherEmployerRecipientEmails: z.string().optional(),

      selectedCourt: z.string().optional(),
      otherCourtName: z.string().optional(),
      otherCourtMainContactName: z.string().optional(),
      otherCourtMainContactEmail: z.union([z.string().email(), z.literal('')]).optional(),
      otherCourtRecipientEmails: z.string().optional(),
    }),
    screeningType: z.object({
      requestedBy: z.enum(['self', 'employer', 'court']),
    }),
  })
  .superRefine((data, ctx) => {
    const { recipients, screeningType } = data
    const { requestedBy } = screeningType

    if (requestedBy === 'self') {
      if (recipients.sendToOther === true) {
        const rows = recipients.selfRecipients || []

        if (rows.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Add at least one recipient',
            path: ['recipients', 'selfRecipients'],
          })
        }

        rows.forEach((row, index) => {
          if (!row.name?.trim()) {
            ctx.addIssue({
              code: 'custom',
              message: 'Recipient name is required',
              path: ['recipients', 'selfRecipients', index, 'name'],
            })
          }

          if (!row.email?.trim()) {
            ctx.addIssue({
              code: 'custom',
              message: 'Recipient email is required',
              path: ['recipients', 'selfRecipients', index, 'email'],
            })
            return
          }

          if (!z.email().safeParse(row.email.trim()).success) {
            ctx.addIssue({
              code: 'custom',
              message: 'Please enter a valid recipient email',
              path: ['recipients', 'selfRecipients', index, 'email'],
            })
          }
        })
      }
      return
    }

    if (requestedBy === 'employer') {
      if (!recipients.selectedEmployer) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please select an employer',
          path: ['recipients', 'selectedEmployer'],
        })
      }

      if (recipients.selectedEmployer === 'other') {
        if (!recipients.otherEmployerName?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'Employer name is required',
            path: ['recipients', 'otherEmployerName'],
          })
        }
        if (!recipients.otherEmployerMainContactEmail?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'Main contact email is required',
            path: ['recipients', 'otherEmployerMainContactEmail'],
          })
        }
      }

      return
    }

    if (!recipients.selectedCourt) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please select a court',
        path: ['recipients', 'selectedCourt'],
      })
    }

    if (recipients.selectedCourt === 'other') {
      if (!recipients.otherCourtName?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Court name is required',
          path: ['recipients', 'otherCourtName'],
        })
      }
      if (!recipients.otherCourtMainContactEmail?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Main contact email is required',
          path: ['recipients', 'otherCourtMainContactEmail'],
        })
      }
    }
  })

export const termsSchema = z.object({
  terms: termsAndConditionsFieldSchema,
})

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

export type FormValues = z.infer<typeof formSchema>

export const stepSchemas = [
  personalInfoSchema,
  accountInfoSchema,
  screeningTypeSchema,
  recipientsSchema,
  termsSchema,
]

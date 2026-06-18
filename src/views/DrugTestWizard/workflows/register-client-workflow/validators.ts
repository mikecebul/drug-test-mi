import { z } from 'zod'

const additionalRecipientRowSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
})

export const personalInfoFieldSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required' }),
  lastName: z.string().min(1, { error: 'Last name is required' }),
  middleInitial: z
    .string()
    .trim()
    .min(1, { error: 'Middle initial is required' })
    .max(1, { error: 'Middle initial must be a single character' }),
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

const recipientsFieldSchema = z.object({
  additionalReferralRecipients: z.array(additionalRecipientRowSchema).optional(),

  selectedEmployer: z.string().optional(),
  otherEmployerName: z.string().optional(),
  otherEmployerMainContactName: z.string().optional(),
  otherEmployerMainContactEmail: z.union([z.string().email(), z.literal('')]).optional(),
  otherEmployerRecipientEmails: z.string().optional(),
  otherEmployerAdditionalRecipients: z.array(additionalRecipientRowSchema).optional(),

  selectedCourt: z.string().optional(),
  otherCourtName: z.string().optional(),
  otherCourtMainContactName: z.string().optional(),
  otherCourtMainContactEmail: z.union([z.string().email(), z.literal('')]).optional(),
  otherCourtRecipientEmails: z.string().optional(),
  otherCourtAdditionalRecipients: z.array(additionalRecipientRowSchema).optional(),
})

type RecipientValues = z.infer<typeof recipientsFieldSchema>
type RequestedBy = 'self' | 'employer' | 'court' | ''

function validateRecipients(
  recipients: RecipientValues,
  requestedBy: RequestedBy,
  addIssue: (issue: { code: 'custom'; message: string; path: Array<string | number> }) => void,
  pathPrefix: Array<string | number> = [],
) {
  const path = (...parts: Array<string | number>) => [...pathPrefix, ...parts]
  const validateAdditionalRows = (
    rows: Array<{ name?: string; email?: string }>,
    rowPath: Array<string | number>,
  ) => {
    const seenEmails = new Map<string, number>()

    rows.forEach((row, index) => {
      const email = row.email?.trim() || ''
      if (!email) {
        addIssue({
          code: 'custom',
          message: 'Recipient email is required',
          path: [...rowPath, index, 'email'],
        })
        return
      }

      if (!z.email().safeParse(email).success) {
        addIssue({
          code: 'custom',
          message: 'Please enter a valid recipient email',
          path: [...rowPath, index, 'email'],
        })
        return
      }

      const key = email.toLowerCase()
      const duplicateIndex = seenEmails.get(key)
      if (duplicateIndex !== undefined) {
        addIssue({
          code: 'custom',
          message: 'Duplicate recipient email',
          path: [...rowPath, index, 'email'],
        })
        return
      }

      seenEmails.set(key, index)
    })
  }

  if (requestedBy === 'self') {
    const rows = recipients.additionalReferralRecipients || []
    validateAdditionalRows(rows, path('additionalReferralRecipients'))
    return
  }

  if (requestedBy === 'employer') {
    if (!recipients.selectedEmployer) {
      addIssue({
        code: 'custom',
        message: 'Please select an employer',
        path: path('selectedEmployer'),
      })
    }

    if (recipients.selectedEmployer === 'other') {
      if (!recipients.otherEmployerName?.trim()) {
        addIssue({
          code: 'custom',
          message: 'Employer name is required',
          path: path('otherEmployerName'),
        })
      }
      if (!recipients.otherEmployerMainContactEmail?.trim()) {
        addIssue({
          code: 'custom',
          message: 'Main contact email is required',
          path: path('otherEmployerMainContactEmail'),
        })
      }

      const rows = recipients.otherEmployerAdditionalRecipients || []
      validateAdditionalRows(rows, path('otherEmployerAdditionalRecipients'))
    }

    const rows = recipients.additionalReferralRecipients || []
    validateAdditionalRows(rows, path('additionalReferralRecipients'))

    return
  }

  if (!recipients.selectedCourt) {
    addIssue({
      code: 'custom',
      message: 'Please select a court',
      path: path('selectedCourt'),
    })
  }

  if (recipients.selectedCourt === 'other') {
    if (!recipients.otherCourtName?.trim()) {
      addIssue({
        code: 'custom',
        message: 'Court name is required',
        path: path('otherCourtName'),
      })
    }
    if (!recipients.otherCourtMainContactEmail?.trim()) {
      addIssue({
        code: 'custom',
        message: 'Main contact email is required',
        path: path('otherCourtMainContactEmail'),
      })
    }

    const rows = recipients.otherCourtAdditionalRecipients || []
    validateAdditionalRows(rows, path('otherCourtAdditionalRecipients'))
  }

  const rows = recipients.additionalReferralRecipients || []
  validateAdditionalRows(rows, path('additionalReferralRecipients'))
}

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

const accountPasswordFieldSchema = accountInfoFieldSchema.pick({
  password: true,
  confirmPassword: true,
})

const accountEmailFieldSchema = accountInfoFieldSchema.pick({
  email: true,
})

export const accountInfoOptionalEmailGroupSchema = z
  .object({
    noEmail: z.boolean().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const passwordResult = accountPasswordFieldSchema.safeParse(data)
    if (!passwordResult.success) {
      passwordResult.error.issues.forEach((issue) => {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        })
      })
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: "Passwords don't match",
        path: ['confirmPassword'],
      })
    }

    if (data.noEmail) {
      return
    }

    const emailResult = accountEmailFieldSchema.safeParse(data)
    if (!emailResult.success) {
      emailResult.error.issues.forEach((issue) => {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        })
      })
    }
  })

export const screeningTypeSchema = z.object({
  screeningType: screeningRequestFieldSchema,
})

export const recipientsSchema = z
  .object({
    recipients: recipientsFieldSchema,
    screeningType: z.object({
      requestedBy: z.enum(['self', 'employer', 'court']),
    }),
  })
  .superRefine((data, ctx) => {
    const { recipients, screeningType } = data
    validateRecipients(recipients, screeningType.requestedBy, ctx.addIssue, ['recipients'])
  })

export const getRecipientsGroupSchema = (requestedBy: RequestedBy) =>
  recipientsSchema.shape.recipients.superRefine((recipients, ctx) => {
    validateRecipients(recipients, requestedBy, ctx.addIssue)
  })

export const termsSchema = z.object({
  terms: termsAndConditionsFieldSchema,
})

export const formSchema = z.object({
  personalInfo: personalInfoSchema.shape.personalInfo,
  accountInfo: accountInfoOptionalEmailGroupSchema,
  screeningType: screeningTypeSchema.shape.screeningType,
  recipients: recipientsSchema.shape.recipients,
  terms: termsSchema.shape.terms,
})
.refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
  message: "Passwords don't match",
  path: ['accountInfo', 'confirmPassword'],
})

export type FormValues = z.input<typeof formSchema>
export type CompleteRegistrationValues = z.output<typeof formSchema>

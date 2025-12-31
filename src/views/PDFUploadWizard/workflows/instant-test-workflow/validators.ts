import { z } from 'zod'
import { clientSchema, medicationsSchema } from '../shared-validators'

// Step names as readonly tuple
export const steps = [
  'upload',
  'extract',
  'client',
  'medications',
  'verifyData',
  'confirm',
  'reviewEmails',
] as const
export type Steps = typeof steps

// Individual schemas (one per step)
export const uploadSchema = z.object({
  upload: z.object({
    file: z.instanceof(File, { message: 'Please upload a PDF file' }),
  }),
})

export const extractSchema = z.object({
  extract: z.object({
    extracted: z.boolean(),
  }),
})

export { clientSchema, medicationsSchema }

export const verifyDataSchema = z.object({
  verifyData: z
    .object({
      testType: z.enum(['15-panel-instant']),
      collectionDate: z.string().min(1, 'Collection date is required'),
      detectedSubstances: z.array(z.string()),
      isDilute: z.boolean(),
      breathalyzerTaken: z.boolean(),
      breathalyzerResult: z.number().nullable().optional(),
      confirmationDecision: z.enum(['accept', 'request-confirmation', 'pending-decision']).nullable().optional(),
      confirmationSubstances: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.breathalyzerTaken && (data.breathalyzerResult === null || data.breathalyzerResult === undefined)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Breathalyzer result is required when breathalyzer is taken',
          path: ['breathalyzerResult'],
        })
      }
    }),
})

export const emailsSchema = z
  .object({
    emails: z.object({
      clientEmailEnabled: z.boolean(),
      clientRecipients: z.array(z.string()),
      referralEmailEnabled: z.boolean(),
      referralRecipients: z.array(z.string()),
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.emails.clientEmailEnabled && !data.emails.referralEmailEnabled) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one email type must be enabled',
        path: ['emails'],
      })
    }
  })

// Combined schema
export const formSchema = z.object({
  ...uploadSchema.shape,
  ...extractSchema.shape,
  ...clientSchema.shape,
  ...medicationsSchema.shape,
  ...verifyDataSchema.shape,
  ...emailsSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>

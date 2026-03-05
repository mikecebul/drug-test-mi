import { z } from 'zod'
import { clientSchema, medicationsSchema, emailsSchema } from '../shared-validators'

// Step names as readonly tuple
export const steps = ['upload', 'extract', 'client', 'medications', 'verifyData', 'confirm', 'reviewEmails'] as const
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

export { clientSchema, medicationsSchema, emailsSchema }

export const verifyDataSchema = z.object({
  verifyData: z
    .object({
      testType: z.enum(['15-panel-instant']),
      collectionDate: z.string().min(1, 'Collection date is required'),
      detectedSubstances: z.array(z.string()),
      isDilute: z.boolean(),
      breathalyzerTaken: z.boolean(),
      breathalyzerResult: z.number().nullable().optional(),
      confirmationDecisionRequired: z.boolean(),
      confirmationDecision: z.enum(['accept', 'request-confirmation', 'pending-decision']).optional(),
      confirmationSubstances: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
      // Validate breathalyzer result when breathalyzer is taken
      if (data.breathalyzerTaken && (data.breathalyzerResult === null || data.breathalyzerResult === undefined)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Breathalyzer result is required when breathalyzer is taken',
          path: ['breathalyzerResult'],
        })
      }
      if (data.confirmationDecisionRequired === true && data.confirmationDecision === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Must select an option',
          path: ['confirmationDecision'],
        })
      }

      // Validate confirmation substances when requesting confirmation
      // Note: We don't validate confirmationDecision here because whether it's required
      // depends on computed state (medications + detected substances = unexpected positives).
      // The UI conditionally shows/requires this field based on that computed state.
      // Server-side validation will ensure it's provided when actually needed.
      if (data.confirmationDecision === 'request-confirmation') {
        if (!data.confirmationSubstances || data.confirmationSubstances.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Please select at least one substance for confirmation testing',
            path: ['confirmationSubstances'],
          })
        }
      }
    }),
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

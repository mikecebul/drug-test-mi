import { z } from 'zod'
import { emailsSchema, uploadSchema, extractSchema } from '../shared-validators'
import { TEST_TYPES } from '../../utils/testMatching'

// Step names as readonly tuple (6 steps - no medications)
export const steps = ['upload', 'extract', 'matchCollection', 'labScreenData', 'confirm', 'emails'] as const
export type Steps = typeof steps

export const matchCollectionSchema = z.object({
  matchCollection: z.object({
    testId: z.string().min(1, 'Test selection is required'),
    clientName: z.string().min(1),
    testType: z.string().min(1),
    collectionDate: z.string().min(1),
    screeningStatus: z.string().min(1),
    matchType: z.enum(['exact', 'fuzzy', 'manual']),
    score: z.number().min(0).max(100),
  }),
})

export const labScreenDataSchema = z.object({
  labScreenData: z
    .object({
      testType: z.enum(TEST_TYPES),
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

      // Validate confirmation decision when substances are detected
      // Note: This is a simplified check. The UI shows the decision only for unexpected positives,
      // but we validate if any substances are detected to ensure data consistency
      if (data.detectedSubstances.length > 0 && !data.confirmationDecision) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please select how you want to proceed with the detected substances',
          path: ['confirmationDecision'],
        })
      }

      // Validate confirmation substances when requesting confirmation
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

export { emailsSchema, uploadSchema, extractSchema }

// Combined schema (no medications)
export const formSchema = z.object({
  ...uploadSchema.shape,
  ...extractSchema.shape,
  ...matchCollectionSchema.shape,
  ...labScreenDataSchema.shape,
  ...emailsSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>

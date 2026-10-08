import { z } from 'zod'
import { confirmationReviewArraySchema, validateConfirmationReview } from '../components/confirmation-review'
import { emailsGroupSchema, emailsSchema, uploadSchema, extractSchema } from '../shared-validators'
import { TEST_TYPES } from '../../utils/testMatching'

// Step names as readonly tuple (6 steps - no medications)
export const steps = ['upload', 'extract', 'matchCollection', 'labScreenData', 'confirm', 'emails'] as const
export type Steps = typeof steps

export const matchCollectionSchema = z.object({
  matchCollection: z.object({
    testId: z.string().min(1, 'Test selection is required'),
    clientName: z.string().min(1),
    headshot: z.string().nullable().optional(),
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
      screeningResultDate: z
        .string()
        .optional()
        .refine(
          (value) => value === undefined || (!!value && Number.isFinite(new Date(value).getTime())),
          'Enter a valid screening result date',
        ),
      detectedSubstances: z.array(z.string()),
      isDilute: z.boolean(),
      reportHasConfirmation: z.boolean().default(false),
      requiredConfirmationSubstances: z.array(z.string()).default([]),
      confirmationResults: confirmationReviewArraySchema.default([]),
      reviewSourceKey: z.string().nullable().default(null),
      confirmationDecisionRequired: z.boolean(),
      confirmationDecision: z.enum(['accept', 'request-confirmation', 'pending-decision']).optional(),
      confirmationSubstances: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.reportHasConfirmation) {
        try {
          validateConfirmationReview(data.confirmationResults, data.requiredConfirmationSubstances)
        } catch (error) {
          ctx.addIssue({ code: 'custom', message: (error as Error).message, path: ['confirmationResults'] })
        }
      }
      // Validate confirmation decision when unexpected positives are detected
      if (data.confirmationDecisionRequired === true && data.confirmationDecision === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Must select an option',
          path: ['confirmationDecision'],
        })
      }

      // Validate confirmation substances when requesting confirmation
      if (data.confirmationDecisionRequired === true && data.confirmationDecision === 'request-confirmation') {
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

export { emailsGroupSchema, emailsSchema, uploadSchema, extractSchema }

// Combined schema (no medications)
export const formSchema = z.object({
  ...uploadSchema.shape,
  ...extractSchema.shape,
  ...matchCollectionSchema.shape,
  ...labScreenDataSchema.shape,
  ...emailsSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>

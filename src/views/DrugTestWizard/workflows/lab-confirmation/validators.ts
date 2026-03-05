import { z } from 'zod'
import { emailsSchema, uploadSchema, extractSchema } from '../shared-validators'

// Step names as readonly tuple (6 steps - same as lab-screen but for confirmation)
export const steps = [
  'upload',
  'extract',
  'matchCollection',
  'labConfirmationData',
  'confirm',
  'emails',
] as const
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

export const labConfirmationDataSchema = z.object({
  labConfirmationData: z.object({
    // Original screening data (read-only, stored for reference and calculation)
    originalDetectedSubstances: z.array(z.string()),
    originalIsDilute: z.boolean(),

    // Confirmation results (editable)
    confirmationResults: z
      .array(
        z.object({
          substance: z.string().min(1, 'Substance is required'),
          result: z.enum(['confirmed-positive', 'confirmed-negative', 'inconclusive']),
          notes: z.string().optional(),
        }),
      )
      .min(1, 'At least one confirmation result is required'),
  }),
})

export { emailsSchema, uploadSchema, extractSchema }

// Combined schema
export const formSchema = z.object({
  ...uploadSchema.shape,
  ...extractSchema.shape,
  ...matchCollectionSchema.shape,
  ...labConfirmationDataSchema.shape,
  ...emailsSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>

import { allSubstanceOptions } from '@/fields/substanceOptions'
import z from 'zod'
import { clientSchema, medicationsSchema, emailsSchema } from '../shared-validators'

export const steps = ['client', 'medications', 'collection', 'confirm', 'reviewEmails'] as const
export type Steps = typeof steps

export const labTests = ['11-panel-lab', '17-panel-sos-lab', 'etg-lab'] as const
export type LabTests = typeof labTests

export { clientSchema, medicationsSchema, emailsSchema }

export const collectionSchema = z.object({
  collection: z
    .object({
      testType: z.enum(labTests),
      collectionDate: z.string().min(1, 'Collection date is required'),
      breathalyzerTaken: z.boolean(),
      breathalyzerResult: z.number().nullable().optional(),
    })
    .superRefine((data, ctx) => {
      // If breathalyzer is checked, validate result
      if (data.breathalyzerTaken) {
        if (data.breathalyzerResult === null || data.breathalyzerResult === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Breathalyzer result is required',
            path: ['breathalyzerResult'],
          })
        } else if (data.breathalyzerResult < 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Breathalyzer result cannot be negative',
            path: ['breathalyzerResult'],
          })
        } else if (data.breathalyzerResult > 1) {
          ctx.addIssue({
            code: 'custom',
            message: 'Breathalyzer result cannot be greater than 1',
            path: ['breathalyzerResult'],
          })
        }
      }
    }),
})

export const formSchema = z.object({
  ...clientSchema.shape,
  ...medicationsSchema.shape,
  ...collectionSchema.shape,
  ...emailsSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>

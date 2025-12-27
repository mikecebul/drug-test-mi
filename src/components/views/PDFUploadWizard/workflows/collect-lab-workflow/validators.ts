import { Client } from '@/payload-types'
import z from 'zod'

export const steps = ['client', 'medications', 'collection', 'confirm', 'reviewEmails'] as const
export type Steps = typeof steps

export const labTests = ['11-panel-lab', '17-panel-sos-lab', 'etg-lab'] as const
export type LabTests = typeof labTests

export const clientSchema = z.object({
  client: z.object({
    id: z.string().min(1, 'Please select a client'),
    firstName: z.string(),
    lastName: z.string(),
    middleInitial: z.string().nullable(),
    email: z.string(),
    dob: z.string().nullable(),
    headshot: z.string().nullable(),
  }),
})

export const medicationsSchema = z.object({
  medications: z.array(
    z.object({
      medicationName: z.string().min(1, 'Medication name is required'),
      startDate: z.string().min(1, 'Start date is required'), // Payload stores dates as ISO strings
      endDate: z.string().nullable().optional(),
      status: z.enum(['active', 'discontinued']),
      detectedAs: z.array(z.string()).optional(),
      requireConfirmation: z.boolean().optional(),
      notes: z.string().optional(),
      createdAt: z.string().optional(), // May be set server-side
    }),
  ),
})

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
        } else {
          // Check for exactly 3 decimal places
          const decimalPlaces = (data.breathalyzerResult.toString().split('.')[1] || '').length
          if (decimalPlaces !== 3) {
            ctx.addIssue({
              code: 'custom',
              message: 'Breathalyzer result must have exactly 3 decimal places (e.g., 0.000)',
              path: ['breathalyzerResult'],
            })
          }
        }
      }
    }),
})

export const emailsSchema = z
  .object({
    emails: z.object({
      referralEmailEnabled: z.boolean(),
      referralRecipients: z.array(z.string()),
    }),
  })
  .superRefine((data, ctx) => {
    // If referral email enabled, must have at least one recipient
    if (data.emails.referralEmailEnabled && data.emails.referralRecipients.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Referral emails must have at least one recipient',
        path: ['reviewEmails', 'referralRecipients'],
      })
    }
  })

export const formSchema = z.object({
  step: z.enum(steps),
  ...clientSchema.shape,
  ...medicationsSchema.shape,
  ...collectionSchema.shape,
  ...emailsSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>

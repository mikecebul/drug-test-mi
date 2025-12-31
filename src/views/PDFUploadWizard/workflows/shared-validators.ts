import { z } from 'zod'
import { allSubstanceOptions } from '@/fields/substanceOptions'

// Extract substance values from allSubstanceOptions
const substanceValues = allSubstanceOptions.map((s) => s.value)

// Shared client schema used by both collect-lab and instant-test workflows
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

// Type for the client object in form values
export type FormClient = z.infer<typeof clientSchema>['client']

// Shared medication schema used by both collect-lab and instant-test workflows
export const medicationsSchema = z.object({
  medications: z.array(
    z
      .object({
        medicationName: z.string().min(1, 'Medication name is required'),
        startDate: z.string().min(1, 'Start date is required'),
        endDate: z.string().nullable().optional(),
        status: z.enum(['active', 'discontinued']),
        detectedAs: z.array(z.enum(substanceValues)).nullable().optional(),
        requireConfirmation: z.boolean().nullable().optional(),
        notes: z.string().nullable().optional(),
        createdAt: z.string().nullable().optional(),
        // UI state flags (not persisted to server)
        _isNew: z.boolean().optional(),
        _wasDiscontinued: z.boolean().optional(),
      })
      .superRefine((data, ctx) => {
        if (data.status === 'discontinued' && !data.endDate) {
          ctx.addIssue({
            code: 'custom',
            message: 'End date is required for discontinued medications',
            path: ['endDate'],
          })
        }
      }),
  ),
})

// Type for the client object in form values
export type FormMedications = z.infer<typeof medicationsSchema>['medications']

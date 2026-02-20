import { z } from 'zod'
import { allSubstanceOptions } from '@/fields/substanceOptions'

// Extract substance values from allSubstanceOptions
const substanceValues = allSubstanceOptions.map((s) => s.value)

export const uploadSchema = z.object({
  upload: z.object({
    file: z.instanceof(File, { message: 'Please upload a PDF file' }),
  }),
})

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
    headshotId: z.string().nullable(),
  }),
})

export const extractSchema = z.object({
  extract: z.object({
    extracted: z.boolean(),
  }),
})

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
    // If referral email enabled, must have at least one recipient
    if (data.emails.referralEmailEnabled && data.emails.referralRecipients.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Referral emails must have at least one recipient',
        path: ['emails', 'referralRecipients'],
      })
    }
  })

// Type for the client object in form values
export type FormUpload = z.infer<typeof uploadSchema>['upload']
export type FormExtract = z.infer<typeof extractSchema>['extract']
export type FormClient = z.infer<typeof clientSchema>['client']
export type FormMedications = z.infer<typeof medicationsSchema>['medications']
export type FormEmails = z.infer<typeof emailsSchema>['emails']

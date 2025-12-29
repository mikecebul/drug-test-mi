import { z } from 'zod'
import { personalInfoFieldSchema } from '@/app/(frontend)/register/field-groups/PersonalInfoGroup'
import { accountInfoFieldSchema } from '@/app/(frontend)/register/field-groups/AccountInfoGroup'
import { screeningRequestFieldSchema } from '@/app/(frontend)/register/field-groups/ScreeningRequestGroup'
import { termsAndConditionsFieldSchema } from '@/app/(frontend)/register/field-groups/TermsAndConditionsGroup'

// Define step names for the workflow
export const steps = [
  'personalInfo',
  'accountInfo',
  'screeningType',
  'recipients',
  'terms',
] as const

export type Steps = typeof steps

// Step 1: Personal Information
export const personalInfoSchema = z.object({
  personalInfo: personalInfoFieldSchema,
})

// Step 2: Account Information with password confirmation
export const accountInfoSchema = z
  .object({
    accountInfo: accountInfoFieldSchema,
  })
  .refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
    message: "Passwords don't match",
    path: ['accountInfo', 'confirmPassword'],
  })

// Step 3: Screening Type
export const screeningTypeSchema = z.object({
  screeningType: screeningRequestFieldSchema,
})

// Step 4: Recipients (conditional validation based on screening type)
export const recipientsSchema = z
  .object({
    recipients: z.object({
      // Self-pay recipient fields
      useSelfAsRecipient: z.boolean().optional(),
      alternativeRecipientName: z.string().optional(),
      alternativeRecipientEmail: z.union([z.string().email(), z.literal('')]).optional(),

      // Employment recipient fields
      selectedEmployer: z.string().optional(),
      employerName: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.union([z.string().email(), z.literal('')]).optional(),

      // Probation/Court recipient fields
      selectedCourt: z.string().optional(),
      courtName: z.string().optional(),
      probationOfficerName: z.string().optional(),
      probationOfficerEmail: z.union([z.string().email(), z.literal('')]).optional(),
    }),
    screeningType: z.object({
      requestedBy: z.enum(['self', 'employment', 'probation']),
    }),
  })
  .superRefine((data, ctx) => {
    const { recipients, screeningType } = data
    const { requestedBy } = screeningType

    // Conditional validation based on screening type
    if (requestedBy === 'self') {
      if (recipients.useSelfAsRecipient === false) {
        if (!recipients.alternativeRecipientName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Recipient name is required',
            path: ['recipients', 'alternativeRecipientName'],
          })
        }
        if (!recipients.alternativeRecipientEmail) {
          ctx.addIssue({
            code: 'custom',
            message: 'Recipient email is required',
            path: ['recipients', 'alternativeRecipientEmail'],
          })
        }
      }
    } else if (requestedBy === 'employment') {
      if (!recipients.selectedEmployer) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please select an employer',
          path: ['recipients', 'selectedEmployer'],
        })
      }

      // "Other" employer requires manual entry
      if (recipients.selectedEmployer === 'other') {
        if (!recipients.employerName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Employer name is required',
            path: ['recipients', 'employerName'],
          })
        }
        if (!recipients.contactName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Contact name is required',
            path: ['recipients', 'contactName'],
          })
        }
        if (!recipients.contactEmail) {
          ctx.addIssue({
            code: 'custom',
            message: 'Contact email is required',
            path: ['recipients', 'contactEmail'],
          })
        }
      }
    } else if (requestedBy === 'probation') {
      if (!recipients.selectedCourt) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please select a court',
          path: ['recipients', 'selectedCourt'],
        })
      }

      // "Other" court requires manual entry
      if (recipients.selectedCourt === 'other') {
        if (!recipients.courtName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Court name is required',
            path: ['recipients', 'courtName'],
          })
        }
        if (!recipients.probationOfficerName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Probation officer name is required',
            path: ['recipients', 'probationOfficerName'],
          })
        }
        if (!recipients.probationOfficerEmail) {
          ctx.addIssue({
            code: 'custom',
            message: 'Probation officer email is required',
            path: ['recipients', 'probationOfficerEmail'],
          })
        }
      }
    }
  })

// Step 5: Terms and Conditions
export const termsSchema = z.object({
  terms: termsAndConditionsFieldSchema,
})

// Complete form schema
export const formSchema = z.object({
  personalInfo: personalInfoSchema.shape.personalInfo,
  accountInfo: accountInfoSchema.shape.accountInfo,
  screeningType: screeningTypeSchema.shape.screeningType,
  recipients: recipientsSchema.shape.recipients,
  terms: termsSchema.shape.terms,
})
.refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
  message: "Passwords don't match",
  path: ['accountInfo', 'confirmPassword'],
})

// Type inference
export type FormValues = z.infer<typeof formSchema>

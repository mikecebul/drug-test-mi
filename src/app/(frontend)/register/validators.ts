'use client'

import { z } from 'zod'
import {
  steps as adminSteps,
  personalInfoFieldSchema,
  accountInfoFieldSchema,
  screeningRequestFieldSchema,
  termsAndConditionsFieldSchema,
  personalInfoSchema,
  accountInfoSchema,
  screeningTypeSchema,
  recipientsSchema,
  termsSchema,
} from '@/views/PDFUploadWizard/workflows/register-client-workflow/validators'

export const steps = [
  adminSteps[0],
  adminSteps[1],
  adminSteps[2],
  adminSteps[3],
  'medications',
  adminSteps[4],
] as const

export type Steps = typeof steps

export {
  personalInfoFieldSchema,
  accountInfoFieldSchema,
  screeningRequestFieldSchema,
  termsAndConditionsFieldSchema,
  personalInfoSchema,
  accountInfoSchema,
  screeningTypeSchema,
  recipientsSchema,
  termsSchema,
}

export const medicationsSchema = z.object({
  medications: z.array(
    z.object({
      medicationName: z.string().min(1, { error: 'Medication name is required' }),
      detectedAs: z.array(z.string()).min(1, { error: 'Select at least one detected substance' }),
    }),
  ),
})

export const formSchema = z
  .object({
    personalInfo: personalInfoSchema.shape.personalInfo,
    accountInfo: accountInfoSchema.shape.accountInfo,
    screeningType: screeningTypeSchema.shape.screeningType,
    recipients: recipientsSchema.shape.recipients,
    medications: medicationsSchema.shape.medications,
    terms: termsSchema.shape.terms,
  })
  .refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
    message: "Passwords don't match",
    path: ['accountInfo', 'confirmPassword'],
  })

export const completeRegistrationSchema = formSchema

export const stepSchemas = [
  personalInfoSchema,
  accountInfoSchema,
  screeningTypeSchema,
  recipientsSchema,
  medicationsSchema,
  termsSchema,
]

export type FormValues = z.infer<typeof formSchema>
export type RegistrationFormType = FormValues

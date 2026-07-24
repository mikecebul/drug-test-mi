import { z } from 'zod'

import { parseDob } from '@/lib/date-utils'

const phonePattern = /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/

export const clientBasicsFieldsSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  middleInitial: z.string().trim().max(1, 'Use one middle initial'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dob: z
    .string()
    .trim()
    .min(1, 'Date of birth is required')
    .refine((value) => parseDob(value) !== null, 'Enter a valid date of birth'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || phonePattern.test(value), 'Enter a 10-digit phone number'),
  gender: z.enum(['male', 'female', 'prefer-not-to-say', '']),
})

export const clientBasicsUpdateSchema = clientBasicsFieldsSchema.extend({
  clientId: z.string().trim().min(1, 'Client ID is required'),
})

export type ClientBasicsFormValues = z.infer<typeof clientBasicsFieldsSchema>

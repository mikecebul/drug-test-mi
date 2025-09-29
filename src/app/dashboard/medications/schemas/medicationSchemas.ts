import { z } from 'zod'

// Date validation helpers
const today = new Date()
today.setHours(0, 0, 0, 0)

// Allow up to 2 months in the future for reasonable planning
const maxFutureDate = new Date()
maxFutureDate.setMonth(maxFutureDate.getMonth() + 2)

// Don't allow backdating more than 2 months in the past
const minPastDate = new Date()
minPastDate.setMonth(minPastDate.getMonth() - 2)

// Custom date schema that accepts both Date objects and strings
const dateSchema = z.union([
  z.date(),
  z.string().min(1, 'Date is required').transform((str) => new Date(str))
]).refine((date) => !isNaN(date.getTime()), {
  message: 'Invalid date format'
})

// Add medication schema
export const addMedicationSchema = z.object({
  medicationName: z.string().min(1, 'Medication name is required'),
  detectedAs: z.string().optional(),
  startDate: dateSchema.refine((date) => {
    return date <= maxFutureDate
  }, {
    message: 'Start date cannot be more than 2 months in the future'
  }),
})

// Update medication schema with cross-field validation
export const updateMedicationSchema = z.object({
  status: z.enum(['active', 'discontinued']),
  endDate: z.union([
    z.date(),
    z.string(),
    z.undefined()
  ]).optional().transform((val) => {
    if (!val || val === '') return undefined
    if (val instanceof Date) return val
    return new Date(val)
  }),
}).refine((data) => {
  if (data.status === 'discontinued' && !data.endDate) {
    return false
  }
  return true
}, {
  message: 'End date is required when discontinuing medication',
  path: ['endDate'],
}).refine((data) => {
  if (data.endDate && !isNaN(data.endDate.getTime())) {
    return data.endDate <= maxFutureDate
  }
  return true
}, {
  message: 'End date cannot be more than 2 months in the future',
  path: ['endDate'],
}).refine((data) => {
  if (data.endDate && !isNaN(data.endDate.getTime())) {
    return data.endDate >= minPastDate
  }
  return true
}, {
  message: 'End date cannot be more than 2 months in the past. For larger changes, contact support: (231) 373-6341 or mike@midrugtest.com',
  path: ['endDate'],
})

// Enhanced validation function that includes start date comparison
export const createUpdateMedicationSchema = (startDate?: string | Date) => {
  const parsedStartDate = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null

  return updateMedicationSchema.refine((data) => {
    if (data.endDate && parsedStartDate && !isNaN(data.endDate.getTime()) && !isNaN(parsedStartDate.getTime())) {
      return data.endDate >= parsedStartDate
    }
    return true
  }, {
    message: 'End date cannot be before the medication start date',
    path: ['endDate'],
  })
}

// Combined schema for validating medication dates together
export const medicationDateValidationSchema = z.object({
  startDate: dateSchema,
  endDate: z.union([z.date(), z.string(), z.undefined()]).optional().transform((val) => {
    if (!val || val === '') return undefined
    if (val instanceof Date) return val
    return new Date(val)
  })
}).refine((data) => {
  if (data.endDate && !isNaN(data.endDate.getTime())) {
    return data.endDate >= data.startDate
  }
  return true
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
})

// Type inference
export type AddMedicationFormType = z.infer<typeof addMedicationSchema>
export type UpdateMedicationFormType = z.infer<typeof updateMedicationSchema>
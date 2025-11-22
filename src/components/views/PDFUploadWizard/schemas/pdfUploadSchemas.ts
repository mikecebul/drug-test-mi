import { z } from 'zod'

// Step 1: Upload
export const uploadSchema = z.object({
  uploadData: z.object({
    file: z.instanceof(File, { message: 'Please upload a PDF file' }),
  }),
})

// Step 2: Extract
export const extractSchema = z.object({
  extractData: z.object({
    donorName: z.string().nullable(),
    collectionDate: z.date().nullable(),
    detectedSubstances: z.array(z.string()),
    isDilute: z.boolean(),
    rawText: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    extractedFields: z.array(z.string()),
  }),
})

// Step 3: Verify Client
export const verifyClientSchema = z.object({
  clientData: z.object({
    id: z.string().min(1, 'Please select a client'),
    firstName: z.string(),
    lastName: z.string(),
    middleInitial: z.string().nullable(),
    email: z.string().email(),
    dob: z.string().nullable(),
    matchType: z.enum(['exact', 'fuzzy']),
    score: z.number().optional(),
  }),
})

// Step 4: Verify Data
export const verifyDataSchema = z.object({
  verifyData: z.object({
    testType: z.enum(['15-panel-instant', '11-panel-lab', '17-panel-sos-lab', 'etg-lab']),
    collectionDate: z.string().min(1, 'Collection date is required'),
    detectedSubstances: z.array(z.string()),
    isDilute: z.boolean(),
  }),
})

// Step 5: Confirm
export const confirmSchema = z.object({
  confirmData: z.object({
    previewComputed: z.boolean(),
  }),
})

// Step schemas array for the stepper hook
export const stepSchemas = [
  uploadSchema,
  extractSchema,
  verifyClientSchema,
  verifyDataSchema,
  confirmSchema,
]

// Complete form schema for final validation
export const completePdfUploadSchema = z.object({
  uploadData: uploadSchema.shape.uploadData,
  extractData: extractSchema.shape.extractData,
  clientData: verifyClientSchema.shape.clientData,
  verifyData: verifyDataSchema.shape.verifyData,
  confirmData: confirmSchema.shape.confirmData,
})

// Type inference
export type PdfUploadFormType = z.infer<typeof completePdfUploadSchema>

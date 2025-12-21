import { z } from 'zod'
import { uploadFieldSchema } from '../field-groups/BaseUploadFieldGroup'
import { extractFieldSchema } from '../field-groups/ExtractFieldGroup'
import { verifyClientFieldSchema } from '../field-groups/VerifyClientFieldGroup'
import { verifyMedicationsFieldSchema } from '../field-groups/VerifyMedicationsFieldGroup'
import { verifyDataFieldSchema } from '../field-groups/BaseVerifyDataFieldGroup'
import { confirmFieldSchema } from '../field-groups/BaseConfirmFieldGroup'
import { reviewEmailsFieldSchema } from '../field-groups/BaseReviewEmailsFieldGroup'

// Step 1: Upload - reusing field group schema
export const uploadSchema = z.object({
  uploadData: uploadFieldSchema,
})

// Step 2: Extract - reusing field group schema
export const extractSchema = z.object({
  extractData: extractFieldSchema,
})

// Step 3: Verify Client - reusing field group schema
export const verifyClientSchema = z.object({
  clientData: verifyClientFieldSchema,
})

// Step 4: Verify Medications - reusing field group schema
export const verifyMedicationsSchema = z.object({
  medicationsData: verifyMedicationsFieldSchema,
})

// Step 5: Verify Data - reusing field group schema
export const verifyDataSchema = z.object({
  verifyData: verifyDataFieldSchema,
})

// Step 6: Confirm - reusing field group schema
export const confirmSchema = z.object({
  confirmData: confirmFieldSchema,
})

// Step 7: Review Emails - reusing field group schema
export const reviewEmailsSchema = z.object({
  reviewEmailsData: reviewEmailsFieldSchema,
})

// Step schemas array for the stepper hook
export const stepSchemas = [
  uploadSchema,
  extractSchema,
  verifyClientSchema,
  verifyMedicationsSchema,
  verifyDataSchema,
  confirmSchema,
  reviewEmailsSchema,
]

// Complete form schema for final validation
export const completePdfUploadSchema = z.object({
  uploadData: uploadSchema.shape.uploadData,
  extractData: extractSchema.shape.extractData,
  clientData: verifyClientSchema.shape.clientData,
  medicationsData: verifyMedicationsSchema.shape.medicationsData,
  verifyData: verifyDataSchema.shape.verifyData,
  confirmData: confirmSchema.shape.confirmData,
  reviewEmailsData: reviewEmailsSchema.shape.reviewEmailsData,
})

// Type inference
export type PdfUploadFormType = z.infer<typeof completePdfUploadSchema>

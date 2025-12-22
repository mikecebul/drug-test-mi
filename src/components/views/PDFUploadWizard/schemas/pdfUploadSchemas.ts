import { z } from 'zod'
import { uploadFieldSchema } from '../field-groups/UploadFieldGroup'
import { extractFieldSchema } from '../field-groups/ExtractFieldGroup'
import { verifyClientFieldSchema } from '../field-groups/VerifyClient/VerifyClientFieldGroup'
import { verifyDataFieldSchema } from '../field-groups/VerifyDataFieldGroup'
import { reviewEmailsFieldSchema } from '../field-groups/ReviewEmailsFieldGroup'
import { testSummaryFieldSchema } from '../field-groups/TestSummary'
import { collectionDetailsFieldSchema } from '../field-groups/CollectionDetailsFieldGroup'
import { verifyMedicationsFieldSchema } from '../field-groups/VerifyMedicationsFieldGroup'

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
export const testSummarySchema = z.object({
  testSummary: testSummaryFieldSchema,
})

// Step 7: Review Emails - reusing field group schema
export const reviewEmailsSchema = z.object({
  reviewEmailsData: reviewEmailsFieldSchema,
})

// Step schemas array for the stepper hook
export const instantTestStepSchemas = [
  uploadSchema,
  extractSchema,
  verifyClientSchema,
  verifyMedicationsSchema,
  verifyDataSchema,
  testSummarySchema,
  reviewEmailsSchema,
]

// Collect Lab form step schemas
// Step 1: Verify Client - reusing field group schema
// Step 2: Verify Medications - reusing field group schema
// Step 3: Collection Details
export const collectionDetailsSchema = z.object({
  collectionDetails: collectionDetailsFieldSchema,
})

// Step 4: Confirm Schema
export const confirmSchema = z.object({
  confirmData: z.object({
    confirmed: z.boolean(),
  }),
})

// Step 5: Review Emails - reusing field group schema

export const collectLabStepSchemas = [
  verifyClientSchema,
  verifyMedicationsSchema,
  collectionDetailsSchema,
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
  testSummary: testSummarySchema.shape.testSummary,
  reviewEmailsData: reviewEmailsSchema.shape.reviewEmailsData,
})

// Type inference
export type PdfUploadFormType = z.infer<typeof completePdfUploadSchema>

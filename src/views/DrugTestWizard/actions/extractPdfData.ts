'use server'

import { requireWizardAdmin } from '../server/requireWizardAdmin'
import { MAX_REPORT_BYTES, parseDrugTestReport } from '@/utilities/extractors/parseDrugTestReport'
import type { ParsedPDFData, WizardType } from '../types'

/**
 * Extract data from uploaded PDF file
 */
export async function extractPdfData(
  formData: FormData,
  wizardType?: WizardType,
): Promise<{
  success: boolean
  data?: ParsedPDFData
  error?: string
}> {
  const { payload } = await requireWizardAdmin()
  const file = formData.get('file') as File

  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  // Validate file size BEFORE attempting extraction (10MB limit)
  const MAX_FILE_SIZE = MAX_REPORT_BYTES
  if (file.size > MAX_FILE_SIZE) {
    payload.logger.error({
      msg: 'PDF file too large',
      size: file.size,
      filename: file.name,
      maxSize: MAX_FILE_SIZE,
    })
    return {
      success: false,
      error: `PDF file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB. Please ensure you uploaded the correct file.`,
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    const expectedFamily =
      wizardType === 'lab-results' || wizardType === 'enter-lab-confirmation' || wizardType === 'enter-lab-screen'
        ? 'lab'
        : wizardType === 'instant-test' || wizardType === '17-panel-instant'
          ? 'instant'
          : undefined
    const extracted = await parseDrugTestReport(buffer, expectedFamily)

    return { success: true, data: extracted }
  } catch (error) {
    // Log full error context for debugging
    payload.logger.error({
      msg: 'PDF extraction failed',
      error,
      wizardType,
      fileSize: file.size,
      fileName: file.name,
      errorType: error?.constructor?.name,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Provide specific error messages based on error type
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('Invalid PDF') || errorMessage.includes('PDF header')) {
      return {
        success: false,
        error: 'This file appears to be corrupt or not a valid PDF. Please check the file and try again.',
      }
    }

    if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
      return {
        success: false,
        error: 'This PDF is password-protected. Please remove the password and try again.',
      }
    }

    return {
      success: false,
      error: `Failed to extract PDF data: ${errorMessage}. Please try a different file or contact support if the problem persists.`,
    }
  }
}

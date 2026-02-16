'use server'

import { updateTestWithScreening } from '@/views/DrugTestWizard/actions'
import { generateTestFilename } from '@/views/DrugTestWizard/utils/generateFilename'
import type { FormValues } from '../validators'
import type { ExtractedPdfData } from '@/views/DrugTestWizard/queries'
import type { SubstanceValue } from '@/fields/substanceOptions'

export async function updateLabScreenAction(
  formValues: FormValues,
  extractedData: ExtractedPdfData | undefined,
): Promise<{ success: boolean; testId?: string; error?: string }> {
  try {
    // Convert File to buffer array
    const arrayBuffer = await formValues.upload.file.arrayBuffer()
    const pdfBuffer = Array.from(new Uint8Array(arrayBuffer))

    // Generate filename
    // Parse client name into first and last name
    const nameParts = formValues.matchCollection.clientName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts[nameParts.length - 1] || ''

    const filename = generateTestFilename({
      client: { firstName, lastName },
      collectionDate: formValues.labScreenData.collectionDate,
      testType: formValues.labScreenData.testType as any,
      isConfirmation: false,
    })

    // Build confirmation results from extracted data (if available)
    const confirmationResults = extractedData?.confirmationResults
      ? extractedData.confirmationResults.map((r) => ({
          substance: r.substance as SubstanceValue,
          result: r.result,
          notes: r.notes,
        }))
      : undefined

    // Call existing action
    const result = await updateTestWithScreening({
      testId: formValues.matchCollection.testId,
      detectedSubstances: formValues.labScreenData.detectedSubstances as SubstanceValue[],
      isDilute: formValues.labScreenData.isDilute,
      pdfBuffer,
      pdfFilename: filename,
      hasConfirmation: extractedData?.hasConfirmation,
      confirmationResults,
      confirmationDecision: formValues.labScreenData.confirmationDecision,
      confirmationSubstances: formValues.labScreenData.confirmationSubstances as SubstanceValue[],
    })

    // Return testId with result
    return {
      ...result,
      testId: formValues.matchCollection.testId,
    }
  } catch (error) {
    console.error('Error updating lab screen:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update test record',
    }
  }
}

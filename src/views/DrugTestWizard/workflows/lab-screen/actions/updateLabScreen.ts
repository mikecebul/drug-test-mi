'use server'

import { updateTestWithScreening } from '@/views/DrugTestWizard/actions'
import { generateTestFilename } from '@/views/DrugTestWizard/utils/generateFilename'
import { labScreenDataSchema, type FormValues } from '../validators'
import { readLabReportFile } from '../../components/readLabReport'
import { reconcileConfirmationSubmission } from '../../components/confirmation-review'
import type { ExtractedPdfData } from '@/views/DrugTestWizard/queries'
import type { SubstanceValue } from '@/fields/substanceOptions'

export async function updateLabScreenAction(
  formValues: FormValues,
  _extractedData: ExtractedPdfData | undefined,
): Promise<{ success: boolean; testId?: string; error?: string }> {
  try {
    const input = labScreenDataSchema.shape.labScreenData.safeParse(formValues.labScreenData)
    if (!input.success) return { success: false, error: 'Review the screening and confirmation results before saving' }
    const file = await readLabReportFile(formValues.upload.file)
    if (file.report.reportKind === 'confirmation')
      return {
        success: false,
        error: 'This report only contains confirmation results. Attach it using Enter Lab Confirmation Data.',
      }
    const reviewed = file.report.hasConfirmation
      ? reconcileConfirmationSubmission(file.report, input.data.confirmationResults)
      : undefined
    const pdfBuffer = Array.from(file.buffer)

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

    const confirmationResults = reviewed?.results

    // Call existing action
    const result = await updateTestWithScreening({
      testId: formValues.matchCollection.testId,
      detectedSubstances: formValues.labScreenData.detectedSubstances as SubstanceValue[],
      isDilute: formValues.labScreenData.isDilute,
      pdfBuffer,
      pdfFilename: filename,
      hasConfirmation: Boolean(reviewed),
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

'use server'

import { requireWizardAdmin } from '../server/requireWizardAdmin'
import type { SubstanceValue } from '@/fields/substanceOptions'
import type { DrugTest } from '@/payload-types'
import { validateConfirmationReview, storedConfirmationRows } from '../workflows/components/confirmation-review'

/**
 * Update an existing test with screening results
 */
export async function updateTestWithScreening(data: {
  testId: string
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  pdfBuffer: number[]
  pdfFilename: string
  hasConfirmation?: boolean
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
  confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
  confirmationSubstances?: SubstanceValue[]
}): Promise<{
  success: boolean
  error?: string
}> {
  const { payload } = await requireWizardAdmin()

  try {
    // 1. Get existing test to verify it exists and get client ID
    const existingTest = await payload.findByID({
      collection: 'drug-tests',
      id: data.testId,
      overrideAccess: true,
    })

    if (!existingTest) {
      return { success: false, error: 'Drug test not found' }
    }

    const clientId =
      typeof existingTest.relatedClient === 'string' ? existingTest.relatedClient : existingTest.relatedClient.id

    let confirmationResults = data.confirmationResults
    const confirmationSubstances = [
      ...new Set([
        ...(existingTest.confirmationSubstances ?? []),
        ...(confirmationResults?.map((row) => row.substance) ?? []),
      ]),
    ]
    if (data.hasConfirmation) {
      try {
        const retained = storedConfirmationRows(existingTest.confirmationResults ?? []).filter(
          (row) => !confirmationResults?.some((incoming) => incoming.substance === row.substance),
        )
        confirmationResults = validateConfirmationReview(
          [...(confirmationResults ?? []), ...retained],
          confirmationSubstances,
        )
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }

    // 2. Upload PDF to private-media
    const buffer = Buffer.from(data.pdfBuffer)
    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: clientId,
        documentType: 'drug-test-report',
      },
      file: {
        data: buffer,
        mimetype: 'application/pdf',
        name: data.pdfFilename,
        size: buffer.length,
      },
      overrideAccess: true,
    })

    // 3. Prepare update data
    const updateData: Partial<DrugTest> = {
      detectedSubstances: data.detectedSubstances,
      isDilute: data.isDilute,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened', // Update status to screened
      processNotes: `${existingTest.processNotes || ''}\nScreening results uploaded via wizard`,
    }

    // 4. Add confirmation data if present (from PDF extraction)
    if (data.hasConfirmation && confirmationResults && confirmationResults.length > 0) {
      updateData.confirmationDecision = 'request-confirmation'
      updateData.confirmationSubstances = confirmationSubstances
      updateData.confirmationResults = confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes || undefined,
      }))
    }
    // 4b. Add confirmation decision from wizard (for tests with unexpected positives)
    else if (data.confirmationDecision) {
      updateData.confirmationDecision = data.confirmationDecision
      if (
        data.confirmationDecision === 'request-confirmation' &&
        data.confirmationSubstances &&
        data.confirmationSubstances.length > 0
      ) {
        updateData.confirmationSubstances = data.confirmationSubstances
      }
    }

    // 5. Update the drug test
    await payload.update({
      collection: 'drug-tests',
      id: data.testId,
      data: updateData,
      overrideAccess: true,
    })

    return { success: true }
  } catch (error) {
    payload.logger.error('Error updating test with screening:', error)
    return {
      success: false,
      error: `Failed to update test: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

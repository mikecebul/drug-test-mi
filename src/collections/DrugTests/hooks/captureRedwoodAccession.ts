import type { CollectionBeforeChangeHook } from 'payload'
import type { DrugTest } from '@/payload-types'
import { getTestTypeByValue } from '@/config/test-types'
import { readRelationshipId } from '@/collections/Payments/services/applyPayment'
import { extractPositionedPdfText } from '@/utilities/extractors/pdfText'
import { findRedwoodAccession } from '@/utilities/extractors/redwoodAccession'
import { fetchDocument } from '../services/documentFetch'

export const captureRedwoodAccession: CollectionBeforeChangeHook<DrugTest> = async ({ data, originalDoc, req }) => {
  if (!data || getTestTypeByValue(data.testType ?? originalDoc?.testType)?.category !== 'lab') return data

  const screenChanged = data.testDocument !== undefined &&
    readRelationshipId(data.testDocument) !== readRelationshipId(originalDoc?.testDocument)
  const confirmationChanged = !originalDoc?.accessionNumber && Boolean(data.confirmationDocument) &&
    readRelationshipId(data.confirmationDocument) !== readRelationshipId(originalDoc?.confirmationDocument)
  if (!screenChanged && !confirmationChanged) return data

  const documentId = readRelationshipId(screenChanged ? data.testDocument : data.confirmationDocument)
  const clientId = readRelationshipId(data.relatedClient ?? originalDoc?.relatedClient)
  if (screenChanged) data.accessionNumber = null
  if (!documentId || !clientId) return data

  try {
    const file = await fetchDocument(documentId, req.payload, { req, reportClientId: clientId })
    const pdf = await extractPositionedPdfText(file.buffer)
    data.accessionNumber = findRedwoodAccession(pdf.lines)
  } catch {
    req.payload.logger.warn({ msg: 'Could not read the accession number from a lab report', drugTestId: originalDoc?.id, documentId })
  }
  return data
}

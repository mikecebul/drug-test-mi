import type { CollectionBeforeChangeHook } from 'payload'
import type { DrugTest } from '@/payload-types'
import { getTestTypeByValue } from '@/config/test-types'
import { readRelationshipId } from '@/collections/Payments/services/applyPayment'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { extractLabTest } from '@/utilities/extractors/extractLabTest'
import { normalizeRedwoodAccession } from '@/utilities/extractors/redwoodAccession'
import { matchesReportClientName } from '@/views/DrugTestWizard/workflows/instant-test/utils/reportClientMatch'
import { fetchDocument } from '../services/documentFetch'

const collectionDay = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

export const captureRedwoodAccession: CollectionBeforeChangeHook<DrugTest> = async ({ data, originalDoc, req }) => {
  if (!data || getTestTypeByValue(data.testType ?? originalDoc?.testType)?.category !== 'lab') return data

  const screeningDocumentId = readRelationshipId(data.testDocument === undefined ? originalDoc?.testDocument : data.testDocument)
  const screenChanged = data.testDocument !== undefined &&
    screeningDocumentId !== readRelationshipId(originalDoc?.testDocument)
  const clientId = readRelationshipId(data.relatedClient ?? originalDoc?.relatedClient)
  const testDate = data.collectionDate === undefined ? originalDoc?.collectionDate : data.collectionDate
  const sampleChanged = Boolean(screeningDocumentId) && (
    clientId !== readRelationshipId(originalDoc?.relatedClient) || testDate !== originalDoc?.collectionDate
  )
  const confirmationChanged = !screeningDocumentId && !originalDoc?.accessionNumber && Boolean(data.confirmationDocument) &&
    readRelationshipId(data.confirmationDocument) !== readRelationshipId(originalDoc?.confirmationDocument)
  if (!screenChanged && !sampleChanged && !confirmationChanged) {
    if (data.accessionNumber !== undefined &&
        normalizeRedwoodAccession(data.accessionNumber) !== normalizeRedwoodAccession(originalDoc?.accessionNumber)) {
      data.redwoodReportAccountNumber = null
    }
    return data
  }

  const documentId = screenChanged || sampleChanged ? screeningDocumentId : readRelationshipId(data.confirmationDocument)
  data.accessionNumber = null
  data.redwoodReportAccountNumber = null
  const collectedAt = Date.parse(testDate ?? '')
  if (!documentId || !clientId || !Number.isFinite(collectedAt)) return data

  try {
    const file = await fetchDocument(documentId, req.payload, { req, reportClientId: clientId })
    const report = await extractLabTest(file.buffer)
    const reportCollectedAt = Date.parse(report.collectionDate ?? '')
    if (!report.accessionNumber || !Number.isFinite(reportCollectedAt) ||
      collectionDay.format(collectedAt) !== collectionDay.format(reportCollectedAt)) return data

    const client = await req.payload.findByID({ collection: 'clients', id: clientId, depth: 0, req })
    if (matchesReportClientName(report.donorName, client)) {
      data.accessionNumber = report.accessionNumber
      data.redwoodReportAccountNumber = report.redwoodReportAccountNumber
    }
  } catch {
    req.payload.logger.warn({ msg: 'Could not read the accession number from a lab report', drugTestId: originalDoc?.id, documentId })
  }
  return data
}

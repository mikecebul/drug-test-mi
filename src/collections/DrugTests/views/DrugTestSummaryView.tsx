import type { DocumentViewServerProps, Payload, PayloadRequest } from 'payload'
import type { DrugTest } from '@/payload-types'
import { DrugTestSummaryContent } from './DrugTestSummaryContent'

async function resolveReportLink(report: DrugTest['testDocument'], payload: Payload, req: PayloadRequest) {
  if (!report) return null
  try {
    const media =
      typeof report === 'object' && (report.url || report.filename)
        ? report
        : await payload.findByID({
            collection: 'private-media',
            id: typeof report === 'string' ? report : report.id,
            depth: 0,
            overrideAccess: false,
            req,
          })
    return (
      media.url ||
      (media.filename ? payload.config.routes.api + '/private-media/file/' + encodeURIComponent(media.filename) : null)
    )
  } catch {
    return null
  }
}

export default async function DrugTestSummaryView({ doc, payload, initPageResult }: DocumentViewServerProps) {
  const test = doc as Partial<DrugTest>
  const req = initPageResult.req
  const [screeningReportHref, confirmationReportHref, client, paymentRecords] = await Promise.all([
    resolveReportLink(test.testDocument, payload, req),
    resolveReportLink(test.confirmationDocument, payload, req),
    typeof test.relatedClient === 'string'
      ? payload
          .findByID({ collection: 'clients', id: test.relatedClient, depth: 0, overrideAccess: false, req })
          .catch(() => null)
      : Promise.resolve(test.relatedClient),
    test.id
      ? payload
          .find({
            collection: 'payments',
            where: { or: [{ relatedDrugTest: { equals: test.id } }, { 'allocations.drugTest': { equals: test.id } }] },
            depth: 0,
            pagination: false,
            limit: 0,
            sort: '-createdAt',
            overrideAccess: false,
            req,
          })
          .then((result) => result.docs)
          .catch(() => null)
      : Promise.resolve([]),
  ])
  return (
    <DrugTestSummaryContent
      test={test}
      dob={client?.dob}
      screeningReportHref={screeningReportHref}
      confirmationReportHref={confirmationReportHref}
      paymentRecords={paymentRecords}
    />
  )
}

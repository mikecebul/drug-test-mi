import { createHmac, timingSafeEqual } from 'node:crypto'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { Forbidden, NotFound, type Endpoint, type PayloadRequest } from 'payload'
import { z } from 'zod/v3'
import { readRelationshipId } from '@/collections/Payments/services/applyPayment'
import { fetchDocument } from '@/collections/DrugTests/services/documentFetch'
import { baseUrl } from '@/utilities/baseUrl'

type Tool = NonNullable<NonNullable<MCPPluginConfig['mcp']>['tools']>[number]
const idPattern = /^[a-f0-9]{24}$/
const ttl = 300
const route = '/drug-test-report-download'
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
}
const parameters = {
  testId: z.string().regex(idPattern),
  report: z.enum(['screen', 'confirmation']),
}
export const drugTestReportToolName = 'downloadDrugTestReport'

function sign(secret: string, token: string) {
  return createHmac('sha256', secret).update(`mcp-drug-test-report:${token}`).digest('hex')
}

async function findReport(req: PayloadRequest, testId: string, report: 'screen' | 'confirmation', enforceUserAccess: boolean) {
  const test = await req.payload.findByID({
    collection: 'drug-tests', id: testId, depth: 0, req, disableErrors: true, overrideAccess: !enforceUserAccess,
    select: { relatedClient: true, testDocument: true, confirmationDocument: true, collectionDate: true },
  })
  const reportId = readRelationshipId(report === 'screen' ? test?.testDocument : test?.confirmationDocument)
  const clientId = readRelationshipId(test?.relatedClient)
  if (!reportId || !clientId) return null

  const file = await req.payload.findByID({
    collection: 'private-media', id: reportId, depth: 0, req, disableErrors: true, overrideAccess: !enforceUserAccess,
    select: { documentType: true, mimeType: true, relatedClient: true },
  })
  if (file?.documentType !== 'drug-test-report' || file.mimeType !== 'application/pdf' ||
    readRelationshipId(file.relatedClient) !== clientId) return null
  return { reportId, clientId, collectionDate: test?.collectionDate }
}

export const drugTestReportTool: Tool = {
  name: drugTestReportToolName,
  description: 'Get a five-minute download link for a screening or confirmation PDF attached to a specific drug test. Requires a Super Admin and an explicit MCP key grant.',
  parameters: parameters as unknown as Tool['parameters'],
  handler: async (args, req) => {
    if (req.user?.collection !== 'admins' || req.user.role !== 'superAdmin') throw new Forbidden()
    const { testId, report } = z.object(parameters).parse(args)
    const file = await findReport(req, testId, report, true)
    if (!file) throw new NotFound()

    const expires = Math.floor(Date.now() / 1000) + ttl
    const token = `${testId}.${report}.${file.reportId}.${expires}`
    const url = new URL(`/api${route}/${token}.${sign(req.payload.secret, token)}`, baseUrl)
    return { content: [{ type: 'text', text: JSON.stringify({
      url: url.href, testId, report, collectionDate: file.collectionDate, expiresAt: new Date(expires * 1000).toISOString(),
    }) }] }
  },
}

const unavailable = () => new Response(null, { status: 404, headers })

export const drugTestReportDownloadEndpoint: Endpoint = {
  path: `${route}/:token`,
  method: 'get',
  handler: async (req) => {
    const signed = req.routeParams?.token
    if (typeof signed !== 'string') return unavailable()
    const match = /^([a-f0-9]{24})\.(screen|confirmation)\.([a-f0-9]{24})\.(\d{10})\.([a-f0-9]{64})$/.exec(signed)
    if (!match) return unavailable()
    const [, testId, report, reportId, expires, signature] = match
    const now = Math.floor(Date.now() / 1000)
    if (Number(expires) <= now || Number(expires) > now + ttl) return unavailable()
    const expected = sign(req.payload.secret, signed.slice(0, signed.lastIndexOf('.')))
    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) return unavailable()

    const file = await findReport(req, testId, report === 'screen' ? 'screen' : 'confirmation', false)
    if (!file || file.reportId !== reportId) return unavailable()

    const { buffer } = await fetchDocument(reportId, req.payload, { req, reportClientId: file.clientId })
    return new Response(new Uint8Array(buffer), {
      headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="drug-test-report.pdf"' },
    })
  },
}

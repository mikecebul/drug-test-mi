import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { drugTestReportDownloadEndpoint, drugTestReportTool } from './drugTestReportTool'

vi.mock('@/utilities/baseUrl', () => ({ baseUrl: 'https://www.midrugtest.example' }))
const fetchDocument = vi.hoisted(() => vi.fn(async () => ({ buffer: Buffer.from('%PDF-synthetic') })))
vi.mock('@/collections/DrugTests/services/documentFetch', () => ({ fetchDocument }))

const testId = '507f1f77bcf86cd799439011'
const reportId = '507f1f77bcf86cd799439012'

function setup() {
  const file = { relatedClient: 'client', documentType: 'drug-test-report', mimeType: 'application/pdf' }
  const test = { id: testId, relatedClient: 'client', testDocument: reportId }
  const findByID = vi.fn(async ({ collection }) => collection === 'drug-tests' ? test : file)
  const req = {
    user: { collection: 'admins', role: 'superAdmin' }, payload: { secret: 'synthetic-secret', findByID },
  } as unknown as PayloadRequest
  const issue = () => drugTestReportTool.handler({ testId, report: 'screen' }, req, {})
  const getToken = async () => {
    const { content } = await issue()
    return new URL(JSON.parse(content[0].text).url).pathname.split('/').at(-1)!
  }
  const open = (token: string) => drugTestReportDownloadEndpoint.handler({ ...req, routeParams: { token } })
  return { test, file, findByID, issue, getToken, open, req }
}

describe('private PDF links from MCP', () => {
  it('issues a signed link for an attached report and streams the exact PDF without caching', async () => {
    const { getToken, open } = setup()
    const response = await open(await getToken())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.text()).toBe('%PDF-synthetic')
  })

  it('blocks invalid signatures and swapped attachments', async () => {
    const { getToken, open, test, findByID } = setup()
    const token = await getToken()
    findByID.mockClear()
    expect((await open(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'))).status).toBe(404)
    expect(findByID).not.toHaveBeenCalled()
    test.testDocument = '507f1f77bcf86cd799439013'
    expect((await open(token)).status).toBe(404)
  })

  it('denies regular admins and files tied to another client', async () => {
    const { file, issue, req } = setup()
    if (req.user?.collection !== 'admins') throw new Error('Missing test admin')
    req.user.role = 'admin'
    await expect(issue()).rejects.toMatchObject({ status: 403 })
    req.user.role = 'superAdmin'
    file.relatedClient = 'other-client'
    await expect(issue()).rejects.toMatchObject({ status: 404 })
  })
})

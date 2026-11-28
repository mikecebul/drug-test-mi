import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrugTest } from '@/payload-types'
import { captureRedwoodAccession } from './captureRedwoodAccession'

const { fetchDocument, extractLabTest, findByID } = vi.hoisted(() => ({
  fetchDocument: vi.fn(),
  extractLabTest: vi.fn(),
  findByID: vi.fn(),
}))
vi.mock('../services/documentFetch', () => ({ fetchDocument }))
vi.mock('@/utilities/extractors/extractLabTest', () => ({ extractLabTest }))

const test = {
  id: 'test-1',
  testType: '11-panel-lab',
  relatedClient: 'client-1',
  collectionDate: '2026-11-07T03:30:00.000Z',
} as DrugTest
const buffer = Buffer.from('report')
const report = {
  accessionNumber: 'AB123456',
  redwoodReportAccountNumber: '310872',
  collectionDate: '2026-11-06T16:00:00.000Z',
  donorName: 'Jamie A Example',
}

function capture(data: Partial<DrugTest>, originalDoc = test) {
  const req = { payload: { logger: { warn: vi.fn() }, findByID } }
  return captureRedwoodAccession({ data, originalDoc, req } as unknown as Parameters<typeof captureRedwoodAccession>[0])
}

describe('capturing a lab report accession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchDocument.mockResolvedValue({ buffer })
    extractLabTest.mockResolvedValue(report)
    findByID.mockResolvedValue({ firstName: 'Jamie', lastName: 'Example' })
  })

  it('stores an accession from a report with the same Detroit collection day', async () => {
    expect(await capture({ testDocument: 'report-1' })).toMatchObject({
      accessionNumber: 'AB123456',
      redwoodReportAccountNumber: '310872',
    })
    expect(fetchDocument).toHaveBeenCalledWith('report-1', expect.anything(), expect.objectContaining({
      reportClientId: 'client-1',
    }))
    expect(extractLabTest).toHaveBeenCalledExactlyOnceWith(buffer)
  })

  it('retains the report accession for another account without silently assuming the approved account', async () => {
    extractLabTest.mockResolvedValueOnce({ ...report, redwoodReportAccountNumber: '310974' })
    expect(await capture({ testDocument: 'report-1' })).toMatchObject({
      accessionNumber: 'AB123456',
      redwoodReportAccountNumber: '310974',
    })
  })

  it('removes verified report account metadata when the accession is corrected manually', async () => {
    const original = { ...test, testDocument: 'report-1', accessionNumber: 'OLD123456', redwoodReportAccountNumber: '310872' }
    expect(await capture({ accessionNumber: 'NEW123456' }, original)).toEqual({
      accessionNumber: 'NEW123456',
      redwoodReportAccountNumber: null,
    })
    expect(extractLabTest).not.toHaveBeenCalled()
  })

  it('clears the accession on a mismatched replacement report or subsequently corrected test date', async () => {
    const original = { ...test, testDocument: 'report-1', accessionNumber: 'OLD123456' }
    expect(await capture({ testDocument: 'report-2', collectionDate: '2026-11-08T15:00:00.000Z' }, original))
      .toMatchObject({ accessionNumber: null })
    expect(await capture({ collectionDate: '2026-11-08T15:00:00.000Z' }, original))
      .toMatchObject({ accessionNumber: null })
  })

  it('does not store an accession for another donor with the same surname and collection day', async () => {
    extractLabTest.mockResolvedValueOnce({ ...report, donorName: 'James A Example' })
    expect(await capture({ testDocument: 'report-1' })).toMatchObject({ accessionNumber: null })
    findByID.mockResolvedValueOnce({ firstName: 'Jamie', lastName: 'Example', middleInitial: 'B' })
    expect(await capture({ testDocument: 'report-1' })).toMatchObject({ accessionNumber: null })
  })

  it('does not backfill accessions on unrelated changes', async () => {
    const original = { ...test, testDocument: 'report-1' }
    expect(await capture({ processNotes: 'Reviewed' }, original)).toEqual({ processNotes: 'Reviewed' })
    expect(extractLabTest).not.toHaveBeenCalled()
  })
})

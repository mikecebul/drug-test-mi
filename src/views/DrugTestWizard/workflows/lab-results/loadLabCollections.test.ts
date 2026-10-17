import { expect, test, vi } from 'vitest'
const find = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payload-sdk', () => ({ sdk: { find } }))
import { loadLabCollections } from './loadLabCollections'
import { sortLabCollections } from './model'
import type { ParsedPDFData } from '../../types'
test('an exact match beyond the first page is available for ranking, and instant tests are excluded', async () => {
  const current = { testType: '11-panel-lab', screeningStatus: 'collected' }
  find.mockResolvedValueOnce({
    docs: Array.from({ length: 100 }, (_, i) => ({ ...current, id: `other-${i}`, clientName: 'Other Person' })),
    hasNextPage: true,
  })
  find.mockResolvedValueOnce({
    docs: [
      { ...current, id: 'exact', relatedClient: { firstName: 'Alex', lastName: 'Morgan' }, clientName: 'Old Name' },
      { ...current, id: 'instant', testType: '17-panel-instant' },
    ],
    hasNextPage: false,
  })
  const result = await loadLabCollections({ reportKind: 'screening' } as ParsedPDFData, 'auto')
  expect(result).toHaveLength(101)
  expect(sortLabCollections(result, '', 'Alex Morgan')[0].id).toBe('exact')
  expect(find).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      page: 2,
      where: { and: expect.arrayContaining([expect.objectContaining({ testType: expect.anything() })]) },
    }),
  )
})

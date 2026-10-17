import { expect, test, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
vi.mock('./actions', () => ({}))
vi.mock('./workflows/components/client/getClients', () => ({}))
vi.mock('./workflows/lab-screen/components/fetchPendingTests', () => ({}))
import { extractPdfQueryKey } from './queries'

test('replacing a report with matching file metadata does not reuse the previous PDF extraction', () => {
  const first = new File(['original'], 'report.pdf', { type: 'application/pdf', lastModified: 1000 })
  const replacement = new File(['replaced'], 'report.pdf', { type: 'application/pdf', lastModified: 1000 })
  const cache = new QueryClient()
  const firstKey = extractPdfQueryKey(first, 'enter-lab-confirmation')
  expect(extractPdfQueryKey(first, 'enter-lab-confirmation')).toEqual(firstKey)
  expect(extractPdfQueryKey(replacement, 'enter-lab-confirmation')).not.toEqual(firstKey)
  cache.setQueryData(firstKey, { confirmationResults: [{ substance: 'fentanyl', result: 'confirmed-positive' }] })
  expect(cache.getQueryData(extractPdfQueryKey(replacement, 'enter-lab-confirmation'))).toBeUndefined()
  expect(cache.getQueryData(firstKey)).toBeDefined()
})

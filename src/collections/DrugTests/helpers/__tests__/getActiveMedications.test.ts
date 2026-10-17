import { expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
import { getActiveMedications } from '../getActiveMedications'
test('collection snapshots retain required medication flags and exclude discontinued medications', async () => {
  const payload = {
    findByID: vi.fn().mockResolvedValue({
      medications: [
        { medicationName: 'Suboxone', detectedAs: ['buprenorphine'], status: 'active', requireConfirmation: true },
        { medicationName: 'Previous prescription', detectedAs: ['amphetamines'], status: 'discontinued' },
      ],
    }),
  } as unknown as Payload
  expect(await getActiveMedications('client', payload)).toEqual([
    { medicationName: 'Suboxone', detectedAs: ['buprenorphine'], required: true },
  ])
})
test('a medication read failure stops collection instead of recording an empty snapshot', async () => {
  const payload = {
    findByID: vi.fn().mockRejectedValue(new Error('Database unavailable')),
    logger: { error: vi.fn() },
  } as unknown as Payload
  await expect(getActiveMedications('client', payload)).rejects.toThrow('Medications could not be loaded')
})

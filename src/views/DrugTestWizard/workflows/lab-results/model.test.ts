import { expect, test } from 'vitest'
import {
  resolveEntryMode,
  eligibleLabCollection,
  legacyLabStep,
  getLabResultsFormOpts,
  resultsSchema,
  sortLabCollections,
} from './model'
import type { ParsedPDFData } from '../../types'
import type { DrugTest } from '@/payload-types'
const report = (kind: ParsedPDFData['reportKind']) =>
  ({ reportKind: kind, hasConfirmation: kind !== 'screening' }) as ParsedPDFData
const collection = (
  screeningStatus: DrugTest['screeningStatus'],
  decision: DrugTest['confirmationDecision'] = 'request-confirmation',
) => ({ screeningStatus, confirmationDecision: decision })
const choices = [
  { id: 'z', clientName: 'Zoe Jones', collectionDate: '2026-01-01T12:00:00Z' },
  { id: 'a-new', clientName: 'Avery Stone', collectionDate: '2026-05-24T12:00:00Z' },
  { id: 'm', clientName: 'Mike Smith', collectionDate: '2025-12-01T12:00:00Z' },
  { id: 'a-old', clientName: 'avery stone', collectionDate: '2026-05-23T12:00:00Z' },
]
test('collection choices sort by client name and then oldest date, regardless of fetch order', () => {
  expect(sortLabCollections(choices, '').map((choice) => choice.id)).toEqual(['a-old', 'a-new', 'm', 'z'])
})
test('the selected collection is pinned first without mutating the fetched list', () => {
  expect(sortLabCollections(choices, 'z').map((choice) => choice.id)).toEqual(['z', 'a-old', 'a-new', 'm'])
  expect(choices.map((choice) => choice.id)).toEqual(['z', 'a-new', 'm', 'a-old'])
})
test('unreadable dates follow dated collections for the same client', () => {
  const rows = [
    { id: 'missing', clientName: 'Avery Stone', collectionDate: null },
    { id: 'invalid', clientName: 'Avery Stone', collectionDate: 'invalid' },
    choices[1],
  ]
  expect(sortLabCollections(rows, '').map((choice) => choice.id)).toEqual(['a-new', 'invalid', 'missing'])
})
test('auto selects the appropriate result stage without changing a stored screen', () => {
  expect(resolveEntryMode('auto', report('screening'), 'collected')).toBe('screening')
  expect(resolveEntryMode('auto', report('confirmation'), 'confirmation-pending')).toBe('confirmation')
  expect(resolveEntryMode('auto', report('screening-and-confirmation'), 'collected')).toBe('screening')
  expect(resolveEntryMode('auto', report('screening-and-confirmation'), 'screened')).toBe('confirmation')
})
test('completed tests and incompatible stages cannot be import targets', () => {
  expect(eligibleLabCollection(collection('complete'), 'auto', report('screening-and-confirmation'))).toBe(false)
  expect(eligibleLabCollection(collection('collected'), 'auto', report('confirmation'))).toBe(false)
  expect(eligibleLabCollection(collection('screened', 'pending-decision'), 'auto', report('confirmation'))).toBe(false)
  expect(
    eligibleLabCollection(collection('confirmation-pending'), 'screening', report('screening-and-confirmation')),
  ).toBe(false)
  expect(eligibleLabCollection(collection('collected'), 'auto', report('screening-and-confirmation'))).toBe(true)
  expect(eligibleLabCollection(collection('confirmation-pending'), 'auto', report('screening-and-confirmation'))).toBe(
    true,
  )
})
test('the active result branch validates all required confirmations and ignores inactive fields', () => {
  const value = getLabResultsFormOpts().defaultValues.results
  value.mode = 'confirmation'
  value.confirmation.requiredSubstances = ['fentanyl', 'thc']
  value.confirmation.confirmationResults = [{ substance: 'fentanyl', result: 'confirmed-negative' }]
  expect(resultsSchema.safeParse(value).success).toBe(false)
  value.confirmation.confirmationResults.push({ substance: 'thc', result: 'confirmed-negative' })
  expect(resultsSchema.safeParse(value).success).toBe(true)
  value.mode = 'screening'
  value.screening.collectionDate = '2026-10-03T14:30:00Z'
  value.screeningVerified = false
  expect(resultsSchema.safeParse(value).success).toBe(false)
  value.screeningVerified = true
  expect(resultsSchema.safeParse(value).success).toBe(true)
})
test.each([
  ['extract', 'upload'],
  ['matchCollection', 'match'],
  ['labScreenData', 'results'],
  ['labConfirmationData', 'results'],
  ['confirm', 'results'],
  ['emails', 'review'],
])('old step %s maps into the four-screen flow', (old, step) => expect(legacyLabStep(old)).toBe(step))

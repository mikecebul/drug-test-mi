import { expect, test } from 'vitest'
import { resolveEntryMode, eligibleLabCollection, legacyLabStep, getLabResultsFormOpts, resultsSchema } from './model'
import type { ParsedPDFData } from '../../types'
import type { DrugTest } from '@/payload-types'
const report = (kind: ParsedPDFData['reportKind']) =>
  ({ reportKind: kind, hasConfirmation: kind !== 'screening' }) as ParsedPDFData
const collection = (
  screeningStatus: DrugTest['screeningStatus'],
  decision: DrugTest['confirmationDecision'] = 'request-confirmation',
) => ({ screeningStatus, confirmationDecision: decision })
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

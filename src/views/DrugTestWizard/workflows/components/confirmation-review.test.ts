import { describe, expect, test } from 'vitest'
import type { ParsedPDFData } from '../../types'
import {
  createConfirmationReviewRows,
  validateConfirmationReview,
  reconcileConfirmationSubmission,
} from './confirmation-review'

const report = (extra: Partial<ParsedPDFData>): ParsedPDFData => ({
  donorName: 'Sample Q Donor',
  collectionDate: '2025-11-19T23:17:00Z',
  detectedSubstances: ['fentanyl', 'thc'],
  isDilute: false,
  rawText: '',
  confidence: 'medium',
  extractedFields: [],
  hasConfirmation: true,
  confirmationComplete: false,
  confirmationAnalytes: [
    {
      analyte: 'Fentanyl',
      substance: 'fentanyl',
      method: 'LC/MS/MS',
      cutoff: null,
      measured: null,
      resultText: 'Negative',
      result: 'confirmed-negative',
      source: { page: 1, bounds: null },
    },
    {
      analyte: 'THC',
      substance: 'thc',
      method: 'LC/MS/MS',
      cutoff: null,
      measured: null,
      resultText: '<100 ng/mL',
      result: null,
      source: { page: 1, bounds: null },
    },
  ],
  confirmationResults: [{ substance: 'fentanyl', result: 'confirmed-negative' }],
  ...extra,
})
describe('reviewing confirmation results', () => {
  test('shows every requested result and leaves an unresolved report result blank', () => {
    const rows = createConfirmationReviewRows(report({}), ['fentanyl', 'thc', 'cocaine'])
    expect(rows.map((row) => [row.substance, row.result])).toEqual([
      ['fentanyl', 'confirmed-negative'],
      ['thc', ''],
      ['cocaine', ''],
    ])
    expect(() => validateConfirmationReview(rows, ['fentanyl', 'thc', 'cocaine'])).toThrow()
    const corrected = rows.map((row) => ({ ...row, result: row.result || ('confirmed-negative' as const) }))
    expect(validateConfirmationReview(corrected, ['fentanyl', 'thc', 'cocaine'])).toHaveLength(3)
  })
  test('rejects a partial submission even when browser-required fields were tampered with', () => {
    expect(() =>
      reconcileConfirmationSubmission(
        report({}),
        [{ substance: 'fentanyl', result: 'confirmed-negative' }],
        ['fentanyl', 'thc'],
      ),
    ).toThrow(/every requested/)
  })
  test('preserves prior received results and the original request on a later report', () => {
    const next = report({
      confirmationComplete: true,
      confirmationAnalytes: [],
      confirmationResults: [{ substance: 'thc', result: 'confirmed-negative' }],
    })
    const result = reconcileConfirmationSubmission(
      next,
      [{ substance: 'thc', result: 'confirmed-negative' }],
      ['fentanyl', 'thc'],
      [{ substance: 'fentanyl', result: 'confirmed-positive', notes: 'Earlier report' }],
    )
    expect(result.substances).toEqual(['fentanyl', 'thc'])
    expect(result.results).toEqual([
      { substance: 'fentanyl', result: 'confirmed-positive', notes: 'Earlier report' },
      { substance: 'thc', result: 'confirmed-negative', notes: undefined },
    ])
  })
  test('does not restore a previous result for a currently ambiguous substance', () => {
    const rows = createConfirmationReviewRows(
      report({ confirmationResults: [] }),
      ['fentanyl', 'thc'],
      [{ substance: 'thc', result: 'confirmed-positive' }],
    )
    expect(rows.find((row) => row.substance === 'thc')?.result).toBe('')
    expect(() =>
      reconcileConfirmationSubmission(
        report({ confirmationResults: [] }),
        [],
        ['thc'],
        [{ substance: 'thc', result: 'confirmed-positive' }],
      ),
    ).toThrow()
  })
  test('requires explicit mapping of unknown analytes and cannot count duplicates toward missing results', () => {
    const unknown = report({ unmappedConfirmationLabels: ['New analyte'] })
    const rows = createConfirmationReviewRows(unknown)
    expect(rows.at(-1)).toMatchObject({ substance: '', result: '', sourceLabels: ['New analyte'] })
    expect(() =>
      reconcileConfirmationSubmission(unknown, [
        { substance: 'fentanyl', result: 'confirmed-negative' },
        { substance: 'thc', result: 'confirmed-negative' },
      ]),
    ).toThrow(/unrecognized/)
    expect(() =>
      validateConfirmationReview(
        [
          { substance: 'fentanyl', result: 'confirmed-negative' },
          { substance: 'fentanyl', result: 'confirmed-positive' },
        ],
        ['fentanyl', 'thc'],
      ),
    ).toThrow(/every requested/)
    const result = reconcileConfirmationSubmission(unknown, [
      { substance: 'fentanyl', result: 'confirmed-negative' },
      { substance: 'thc', result: 'confirmed-negative' },
      { substance: 'fentanyl', result: 'confirmed-positive', sourceLabels: ['New analyte'] },
    ])
    expect(result.results.find((row) => row.substance === 'fentanyl')?.result).toBe('confirmed-positive')
  })
})

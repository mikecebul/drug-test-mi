import { describe, expect, test } from 'vitest'

import { formatSubstance, formatTestType } from '../formatters'

describe('drug test email formatters', () => {
  test('formats 11-panel lab no EtG test type', () => {
    expect(formatTestType('11-panel-lab-no-etg')).toBe('11-Panel Lab Test (no EtG)')
  })

  test('formats alcohol as current intoxication, not EtG', () => {
    expect(formatSubstance('alcohol')).toBe('Alcohol (Current Intoxication)')
    expect(formatSubstance('etg')).toBe('EtG (Past Alcohol Use)')
  })
})

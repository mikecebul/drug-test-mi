import { describe, expect, test } from 'vitest'

import { getSubstanceOptions } from '../substanceOptions'

describe('getSubstanceOptions', () => {
  test('11-panel lab no EtG includes ethanol alcohol and excludes EtG', () => {
    const substances = getSubstanceOptions('11-panel-lab-no-etg')
    const values = substances.map((substance) => substance.value)

    expect(values).toContain('alcohol')
    expect(values).not.toContain('etg')
  })
})

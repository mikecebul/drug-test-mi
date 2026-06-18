import { describe, expect, test } from 'vitest'

import { getSubstanceOptions } from '../substanceOptions'

describe('getSubstanceOptions', () => {
  test('11-panel lab no EtG includes ethanol alcohol and excludes EtG', () => {
    const substances = getSubstanceOptions('11-panel-lab-no-etg')
    const values = substances.map((substance) => substance.value)

    expect(values).toContain('alcohol')
    expect(values).not.toContain('etg')
  })

  test('17-panel instant uses morphine and excludes 6-MAM/opiate panel labels', () => {
    const substances = getSubstanceOptions('17-panel-instant')
    const values = substances.map((substance) => substance.value)

    expect(values).toContain('morphine')
    expect(values).toContain('barbiturates')
    expect(values).toContain('kratom')
    expect(values).toContain('pcp')
    expect(values).not.toContain('6-mam')
    expect(values).not.toContain('opiates')
  })
})

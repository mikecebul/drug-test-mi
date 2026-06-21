import { describe, expect, it } from 'vitest'

import { resolveRedwoodEligibleDefaultTestFromDoc } from '@/lib/redwood/default-test'

describe('resolveRedwoodEligibleDefaultTestFromDoc', () => {
  it('returns an eligible Redwood mapping for lab test types with a Redwood code', () => {
    expect(
      resolveRedwoodEligibleDefaultTestFromDoc({
        id: 'test-1',
        label: '11 Panel Lab',
        value: '11-panel-lab',
        category: 'lab',
        redwoodLabTestCode: 'P40',
      }),
    ).toEqual({
      kind: 'eligible',
      redwoodLabTestCode: 'P40',
      testTypeId: 'test-1',
      testTypeLabel: '11 Panel Lab',
      testTypeValue: '11-panel-lab',
    })
  })

  it('skips instant test types because Redwood only supports lab defaults', () => {
    expect(
      resolveRedwoodEligibleDefaultTestFromDoc({
        id: 'test-2',
        label: '15 Panel Instant',
        value: '15-panel-instant',
        category: 'instant',
        redwoodLabTestCode: null,
      }),
    ).toEqual({
      kind: 'skip',
      reason: 'Redwood default tests only support lab test types.',
    })
  })

  it('returns an error when a lab test type is missing its Redwood lab code mapping', () => {
    expect(
      resolveRedwoodEligibleDefaultTestFromDoc({
        id: 'test-3',
        label: 'EtG Lab',
        value: 'etg-lab',
        category: 'lab',
        redwoodLabTestCode: '',
      }),
    ).toEqual({
      kind: 'error',
      reason: 'Lab test type "EtG Lab" is missing Redwood lab test code mapping.',
    })
  })
})

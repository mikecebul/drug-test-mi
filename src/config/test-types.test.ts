import { describe, expect, test } from 'vitest'

import { getTestTypeByValue } from './test-types'

describe('test type config', () => {
  test('maps the 17-panel SOS lab test to its ToxAccess code', () => {
    expect(getTestTypeByValue('17-panel-sos-lab')?.toxAccessCode).toBe('B306')
  })
})

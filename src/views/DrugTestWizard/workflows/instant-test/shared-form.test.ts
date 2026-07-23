import { describe, expect, test } from 'vitest'

import { getInstantTestFormOpts } from './shared-form'

describe('getInstantTestFormOpts', () => {
  test('creates each form with a current collection date', () => {
    const before = Date.now()
    const options = getInstantTestFormOpts()
    const after = Date.now()
    const collectionDate = options.defaultValues.verifyData.collectionDate

    expect(Date.parse(collectionDate)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(collectionDate)).toBeLessThanOrEqual(after)
  })
})

import { describe, expect, test } from 'vitest'

import { registrationDuplicateWhere } from './registrationDuplicateWhere'

describe('registrationDuplicateWhere', () => {
  test('only treats the same full name and date of birth as a likely duplicate', () => {
    const where = registrationDuplicateWhere({
      firstName: 'Brett',
      lastName: 'Farve',
      dob: '1970-01-01',
    })

    expect(where).toEqual({
      and: [
        { firstName: { equals: 'Brett' } },
        { lastName: { equals: 'Farve' } },
        { searchDob: { equals: '1970-01-01' } },
      ],
    })
    expect(JSON.stringify(where)).not.toContain('phone')
  })
})

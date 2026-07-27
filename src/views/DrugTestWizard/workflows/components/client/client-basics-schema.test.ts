import { describe, expect, it } from 'vitest'

import { clientBasicsFieldsSchema } from './client-basics-schema'

const validClient = {
  firstName: 'Jane',
  middleInitial: 'Q',
  lastName: 'Public',
  dob: '03/13/1982',
  email: 'jane@example.com',
  phone: '(313) 555-6666',
  gender: 'female' as const,
}

describe('clientBasicsFieldsSchema', () => {
  it('accepts the formatted values used by the client editor', () => {
    expect(clientBasicsFieldsSchema.safeParse(validClient).success).toBe(true)
  })

  it.each([
    ['dob', '02/30/2000'],
    ['email', 'not-an-email'],
    ['phone', '313-555'],
    ['middleInitial', 'AB'],
  ])('rejects an invalid %s', (field, value) => {
    expect(clientBasicsFieldsSchema.safeParse({ ...validClient, [field]: value }).success).toBe(false)
  })
})

import { describe, expect, test } from 'vitest'

import { getFirstGroupError } from '../form-group-errors'

describe('getFirstGroupError', () => {
  test('prefers a Zod issue message over the custom issue code', () => {
    expect(
      getFirstGroupError({
        code: 'custom',
        message: 'Must select an option',
        path: ['confirmationDecision'],
      }),
    ).toBe('Must select an option')
  })

  test('finds messages nested inside field errors', () => {
    expect(
      getFirstGroupError({
        fields: {
          confirmationDecision: [
            {
              code: 'custom',
              message: 'Must select an option',
              path: ['confirmationDecision'],
            },
          ],
        },
      }),
    ).toBe('Must select an option')
  })
})

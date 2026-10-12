import { expect, test } from 'vitest'
import { extractSchema as labExtractSchema } from './shared-validators'
import { extractSchema as instantExtractSchema } from './instant-test/validators'

test.each([labExtractSchema, instantExtractSchema])(
  'keeps extraction failures and loading states from advancing the workflow',
  (schema) => {
    const review = { clientMismatchConfirmed: false, clientMismatchConfirmationKey: null }
    expect(schema.safeParse({ extract: { ...review, extracted: false } }).success).toBe(false)
    expect(schema.safeParse({ extract: { ...review, extracted: true } }).success).toBe(true)
  },
)

import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function assertTokenOrder(source: string, tokens: string[]) {
  let cursor = 0

  for (const token of tokens) {
    const index = source.indexOf(token, cursor)
    expect(index).toBeGreaterThanOrEqual(0)
    cursor = index + token.length
  }
}

describe('dashboard widget layout config', () => {
  const payloadConfigPath = path.resolve(process.cwd(), 'src/payload.config.ts')
  const source = readFileSync(payloadConfigPath, 'utf8')

  test('keeps dashboard widget registry in requested order', () => {
    assertTokenOrder(source, [
      "slug: 'wizard-entry'",
      "slug: 'admin-quick-book'",
      "slug: 'total-clients'",
      "slug: 'pending-drug-tests'",
      "slug: 'next-calcom-booking'",
    ])
  })

  test('keeps default dashboard layout in requested order', () => {
    assertTokenOrder(source, [
      "widgetSlug: 'wizard-entry'",
      "widgetSlug: 'admin-quick-book'",
      "widgetSlug: 'total-clients'",
      "widgetSlug: 'pending-drug-tests'",
      "widgetSlug: 'next-calcom-booking'",
    ])
  })
})

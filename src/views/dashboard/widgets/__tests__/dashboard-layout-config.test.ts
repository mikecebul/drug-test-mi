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
      "slug: 'next-calcom-booking'",
      "slug: 'admin-quick-book'",
      "slug: 'pending-drug-tests'",
      "slug: 'admin-alerts'",
    ])
  })

  test('keeps default dashboard layout in requested order', () => {
    assertTokenOrder(source, [
      "widgetSlug: 'next-calcom-booking'",
      "widgetSlug: 'admin-quick-book'",
      "widgetSlug: 'pending-drug-tests'",
      "widgetSlug: 'admin-alerts'",
    ])
  })

  test('uses equal side-by-side widths and full-width priority rows', () => {
    expect(source).toContain("widgetSlug: 'next-calcom-booking',\n          width: 'full'")
    expect(source).toContain("widgetSlug: 'admin-quick-book',\n          width: 'medium'")
    expect(source).toContain("widgetSlug: 'pending-drug-tests',\n          width: 'medium'")
    expect(source).toContain("widgetSlug: 'admin-alerts',\n          width: 'full'")
    assertTokenOrder(source, [
      "'@/views/beforeNavLinks/DrugTestCollectorLink'",
      "'@/views/beforeNavLinks/QuickBookLink'",
      "'@/views/beforeNavLinks/DrugTestTrackerLink'",
    ])
  })
})

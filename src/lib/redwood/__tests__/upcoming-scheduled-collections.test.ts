import { describe, expect, test } from 'vitest'

import { parseUpcomingScheduledCollectionsHtml } from '../upcoming-scheduled-collections'

describe('parseUpcomingScheduledCollectionsHtml', () => {
  test('parses and validates aggregate upcoming counts', () => {
    const html = `
      <table>
        <tr><th>Date</th><th>Male</th><th>Female</th><th>Unspecified</th><th>Total</th></tr>
        <tr><td>08/03/2026</td><td>1</td><td>1</td><td>1</td><td>3</td></tr>
      </table>
    `
    expect(parseUpcomingScheduledCollectionsHtml(html)).toEqual([
      { collectionDate: '2026-08-03', male: 1, female: 1, unspecified: 1, total: 3 },
    ])
  })

  test('fails when ToxAccess aggregate counts do not add up', () => {
    const html = `
      <table>
        <tr><th>Date</th><th>Male</th><th>Female</th><th>Unspecified</th><th>Total</th></tr>
        <tr><td>08/03/2026</td><td>1</td><td>0</td><td>0</td><td>3</td></tr>
      </table>
    `
    expect(() => parseUpcomingScheduledCollectionsHtml(html)).toThrow('counts do not add up')
  })
})

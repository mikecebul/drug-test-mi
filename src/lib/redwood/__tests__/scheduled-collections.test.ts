import { describe, expect, test } from 'vitest'

import { parseScheduledCollectionsHtml } from '../scheduled-collections'

const fixture = `
  <table>
    <tr>
      <th></th><th>Agency</th><th>Donor Group</th><th>Identification</th><th>Test Type</th>
    </tr>
    <tr>
      <td>
        <input type="hidden" name="ctl00$PageContent$grid$ctl02$DonorId" value="1234567" />
        <a href="javascript:__doPostBack('print','')">Print Label</a>
      </td>
      <td>MI Drug Test llc - MI</td>
      <td>2x/wk</td>
      <td>Example Donor</td>
      <td>Urine (lab)</td>
    </tr>
  </table>
`

describe('parseScheduledCollectionsHtml', () => {
  test('extracts the hidden donor ID without opening the print-label action', () => {
    expect(parseScheduledCollectionsHtml(fixture)).toEqual([
      {
        agency: 'MI Drug Test llc - MI',
        donorGroup: '2x/wk',
        donorId: '1234567',
        donorName: 'Example Donor',
        testType: 'Urine (lab)',
      },
    ])
  })

  test('returns an empty list for the ToxAccess no-records state', () => {
    expect(
      parseScheduledCollectionsHtml(`
        <html>
          <body>
            <h1>Scheduled Collections</h1>
            <div class="empty-data">No records to display.</div>
          </body>
        </html>
      `),
    ).toEqual([])
  })

  test('fails closed when the expected table shape changes', () => {
    expect(() => parseScheduledCollectionsHtml('<table><tr><th>Name</th></tr></table>')).toThrow(
      'table headers changed',
    )
  })

  test('does not treat an unrelated no-records page as a valid empty schedule', () => {
    expect(() => parseScheduledCollectionsHtml('<h1>Sign In</h1><p>No records to display.</p>')).toThrow(
      'table headers changed',
    )
  })
})

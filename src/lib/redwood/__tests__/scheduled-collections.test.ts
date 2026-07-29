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

  test('fails closed when the expected table shape changes', () => {
    expect(() => parseScheduledCollectionsHtml('<table><tr><th>Name</th></tr></table>')).toThrow(
      'table headers changed',
    )
  })
})

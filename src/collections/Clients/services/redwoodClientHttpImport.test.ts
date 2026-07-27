import { describe, expect, it } from 'vitest'

import {
  assertRedwoodDonorCreationAllowed,
  assertRedwoodImportDidNotReject,
  assertRedwoodImportUploadAdvanced,
  readRedwoodDonorSearchResults,
  readRedwoodImportFinalSubmitControl,
} from './redwoodClientHttpImport'

describe('redwood HTTP import helpers', () => {
  it('blocks automatic creation when donor identity requires manual review', () => {
    expect(() =>
      assertRedwoodDonorCreationAllowed({
        allowCreate: false,
        blockedReason: 'Potential existing Redwood donor: prior Payload test history was found.',
      }),
    ).toThrow('Potential existing Redwood donor')
  })

  it('extracts donor IDs and cells from Redwood donor search result rows', () => {
    const rows = readRedwoodDonorSearchResults(`
      <table>
        <tr>
          <td>
            <a href="javascript:__doPostBack('ctl00$PageContent$DonorGridView1$gvDonor$ctl03$lbDonorEdit','')">View</a>
            <input type="hidden"
              name="ctl00$PageContent$DonorGridView1$gvDonor$ctl03$hfDonorId"
              id="PageContent_DonorGridView1_gvDonor_hfDonorId_0"
              value="2714034" />
          </td>
          <td class="td-align-middle-padding">Testing, Bob</td>
          <td class="td-align-middle-padding">188644EA193203374B5B</td>
          <td class="td-align-middle-padding">MI Drug Test llc - MI (310872)</td>
        </tr>
      </table>
    `)

    expect(rows).toEqual([
      {
        cells: ['View', 'Testing, Bob', '188644EA193203374B5B', 'MI Drug Test llc - MI (310872)'],
        donorId: '2714034',
        rowIndex: 0,
      },
    ])
  })

  it('does not treat the initial upload button as the final submit control', () => {
    const control = readRedwoodImportFinalSubmitControl(`
      <form>
        <input type="file" name="ctl00$PageContent$ImportDonor1$FileUpload1" />
        <input type="submit" name="ctl00$PageContent$ImportDonor1$btnImport" value="Upload" />
      </form>
    `)

    expect(control).toBeNull()
  })

  it('detects the real review-stage final submit control', () => {
    const control = readRedwoodImportFinalSubmitControl(`
      <form>
        <textarea>1 donor(s) imported. 0 donor(s) rejected.</textarea>
        <input type="submit" name="ctl00$PageContent$ImportDonor1$btnSubmit" value="Submit" />
      </form>
    `)

    expect(control).toEqual({
      name: 'ctl00$PageContent$ImportDonor1$btnSubmit',
      value: 'Submit',
    })
  })

  it('throws when the upload postback returns the unchanged upload page', () => {
    expect(() =>
      assertRedwoodImportUploadAdvanced(`
        <form>
          <input type="file" name="ctl00$PageContent$ImportDonor1$FileUpload1" />
          <input type="submit" name="ctl00$PageContent$ImportDonor1$btnImport" value="Upload" />
        </form>
      `),
    ).toThrow('Redwood donor import upload did not reach review or processed state.')
  })

  it('throws on rejected donor summaries and ignores zero-rejection processed summaries', () => {
    expect(() =>
      assertRedwoodImportDidNotReject(`
        <textarea>0 donor(s) imported. 1 donor(s) rejected. Reason 1: duplicate donor.</textarea>
      `),
    ).toThrow('Redwood donor import was rejected')

    expect(() =>
      assertRedwoodImportDidNotReject(`
        <textarea>1 donor(s) imported. 0 donor(s) rejected. Records processed successfully.</textarea>
      `),
    ).not.toThrow()
  })
})

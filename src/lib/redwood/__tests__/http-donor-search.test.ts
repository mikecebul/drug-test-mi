import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertRedwoodDonorAccountAllowed,
  findRedwoodDonorByNameDobAcrossAccountsViaHttp,
  readRedwoodDonorAccountNumber,
} from '@/lib/redwood/http-donor-search'

function donorRow(accountNumber: string, donorId: string) {
  return `
    <table>
      <tr>
        <td>
          <input type="hidden" name="ctl00$PageContent$DonorGridView1$gvDonor$hfDonorId" value="${donorId}" />
        </td>
        <td>Testing, Bob F</td>
        <td>01/01/1990</td>
        <td>MI Drug Test (${accountNumber})</td>
      </tr>
    </table>
  `
}

describe('Redwood HTTP donor account discovery', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('finds one DOB-verified donor in a different allowed account', async () => {
    const session = {
      getText: vi.fn(async (url: string) => ({
        response: new Response(),
        text: url.includes('agency=310872') ? donorRow('310872', '2714034') : '<table></table>',
      })),
    }

    const result = await findRedwoodDonorByNameDobAcrossAccountsViaHttp({
      accountNumbers: ['310974', '310872'],
      client: {
        dob: '1990-01-01',
        firstName: 'Bob',
        lastName: 'Testing',
        middleInitial: 'F',
      },
      donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
      session: session as never,
    })

    expect(result).toMatchObject({
      accountNumber: '310872',
      donorId: '2714034',
      matchedBy: 'name-dob',
    })
    expect(session.getText).toHaveBeenCalledTimes(2)
  })

  it('requires manual review when the same identity matches multiple accounts', async () => {
    const session = {
      getText: vi.fn(async (url: string) => {
        const accountNumber = url.includes('agency=310872') ? '310872' : '310974'
        return {
          response: new Response(),
          text: donorRow(accountNumber, accountNumber === '310872' ? '2714034' : '2714999'),
        }
      }),
    }

    await expect(
      findRedwoodDonorByNameDobAcrossAccountsViaHttp({
        accountNumbers: ['310974', '310872'],
        client: {
          dob: '1990-01-01',
          firstName: 'Bob',
          lastName: 'Testing',
          middleInitial: 'F',
        },
        donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
        session: session as never,
      }),
    ).rejects.toThrow('across accounts 310974, 310872')
  })

  it('reads and validates the donor account from the edit form', () => {
    vi.stubEnv('REDWOOD_ALLOWED_ACCOUNT_NUMBERS', '310974,310872')
    const html = `
      <select name="ctl00$PageContent$Donor$ddlAgencies">
        <option value="310974">Primary</option>
        <option value="310872" selected="selected">Secondary</option>
      </select>
    `

    expect(readRedwoodDonorAccountNumber(html)).toBe('310872')
    expect(assertRedwoodDonorAccountAllowed(html, '2714034')).toBe('310872')
  })

  it('blocks mutations when a donor belongs to an unapproved account', () => {
    vi.stubEnv('REDWOOD_ALLOWED_ACCOUNT_NUMBERS', '310974')
    const html = `
      <select name="ctl00$PageContent$Donor$ddlAgencies">
        <option value="999999" selected="selected">Other</option>
      </select>
    `

    expect(() => assertRedwoodDonorAccountAllowed(html, '2714034')).toThrow(
      'not in REDWOOD_ALLOWED_ACCOUNT_NUMBERS',
    )
  })
})

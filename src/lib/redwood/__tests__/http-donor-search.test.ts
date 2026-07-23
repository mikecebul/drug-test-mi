import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertRedwoodDonorAccountAllowed,
  findExistingRedwoodDonorMatchesViaHttp,
  findRedwoodDonorByNameDobAcrossAccountsViaHttp,
  findRedwoodDonorByNameDobViaHttp,
  readRedwoodDonorAccountNumber,
} from '@/lib/redwood/http-donor-search'

function donorRow(accountNumber: string, donorId: string, name = 'Testing, Bob F', dob = '01/01/1990') {
  return `
    <table>
      <tr>
        <td>
          <input type="hidden" name="ctl00$PageContent$DonorGridView1$gvDonor$hfDonorId" value="${donorId}" />
        </td>
        <td>${name}</td>
        <td>${dob}</td>
        <td>MI Drug Test (${accountNumber})</td>
      </tr>
    </table>
  `
}

function donorEditForm(accountNumber: string, activeStatus: 'active' | 'inactive') {
  return `
    <form>
      <select name="ctl00$PageContent$Donor$ddlAgencies">
        <option value="${accountNumber}" selected="selected">MI Drug Test</option>
      </select>
      <input type="radio" name="ctl00$PageContent$Donor$Active" value="rdbActive"
        ${activeStatus === 'active' ? 'checked="checked"' : ''} />
      <input type="radio" name="ctl00$PageContent$Donor$Active" value="rdbInActive"
        ${activeStatus === 'inactive' ? 'checked="checked"' : ''} />
    </form>
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

  it('requires manual review when an exact-name donor has a different DOB', async () => {
    const session = {
      getText: vi.fn(async () => ({
        response: new Response(),
        text: donorRow('310872', '2656596', 'Mosley, Ronald', '11/30/1982'),
      })),
    }

    await expect(
      findRedwoodDonorByNameDobViaHttp({
        accountNumber: '310872',
        client: {
          dob: '1982-12-01',
          firstName: 'Ronald',
          lastName: 'Mosley',
        },
        donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
        session: session as never,
      }),
    ).rejects.toThrow(
      'donor 2656596 (Mosley, Ronald) in account 310872 has ToxAccess DOB 1982-11-30, while Payload has DOB 1982-12-01',
    )
  })

  it('does not report a DOB mismatch when the returned donor name is not exact', async () => {
    const session = {
      getText: vi.fn(async () => ({
        response: new Response(),
        text: donorRow('310872', '2656596', 'Mosley, Robert', '11/30/1982'),
      })),
    }

    await expect(
      findRedwoodDonorByNameDobViaHttp({
        accountNumber: '310872',
        client: {
          dob: '1982-12-01',
          firstName: 'Ronald',
          lastName: 'Mosley',
        },
        donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
        session: session as never,
      }),
    ).resolves.toBeNull()
  })

  it('warns about an exact-name DOB mismatch even when another row matches the DOB', async () => {
    const session = {
      getText: vi.fn(async () => ({
        response: new Response(),
        text:
          donorRow('310872', '2656596', 'Mosley, Ronald', '11/30/1982') +
          donorRow('310872', '2656999', 'Mosley, Ron', '12/01/1982'),
      })),
    }

    await expect(
      findRedwoodDonorByNameDobViaHttp({
        accountNumber: '310872',
        client: {
          dob: '1982-12-01',
          firstName: 'Ronald',
          lastName: 'Mosley',
        },
        donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
        session: session as never,
      }),
    ).rejects.toThrow('donor 2656596 (Mosley, Ronald)')
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
    ).rejects.toThrow('across accounts 310974 (donor 2714999, Testing, Bob F), 310872 (donor 2714034, Testing, Bob F)')
  })

  it.each(['active', 'inactive'] as const)(
    'deduplicates one donor returned by both searches, then trusts its %s edit-page status',
    async (activeStatus) => {
      const session = {
        getText: vi.fn(async (url: string) => ({
          response: new Response(),
          text: url.includes('editDonor.aspx') ? donorEditForm('310872', activeStatus) : donorRow('310872', '2714034'),
        })),
      }

      const result = await findExistingRedwoodDonorMatchesViaHttp({
        accountNumbers: ['310872'],
        client: {
          dob: '1990-01-01',
          firstName: 'Bob',
          lastName: 'Testing',
          middleInitial: 'F',
        },
        donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
        session: session as never,
      })
      const verifiedDonor = {
        accountNumber: '310872',
        activeStatus,
        donorId: '2714034',
        matchedBy: 'name-dob',
        matchedDonorName: 'Testing, Bob F',
      }

      expect(result).toEqual({
        active: activeStatus === 'active' ? verifiedDonor : null,
        inactive: activeStatus === 'inactive' ? verifiedDonor : null,
      })
      expect(session.getText).toHaveBeenCalledTimes(3)
    },
  )

  it('preserves distinct donors after verifying one active and one inactive edit page', async () => {
    const session = {
      getText: vi.fn(async (url: string) => {
        const parsedUrl = new URL(url)
        if (parsedUrl.pathname.endsWith('/editDonor.aspx')) {
          const donorId = parsedUrl.searchParams.get('donorid')
          return {
            response: new Response(),
            text: donorEditForm('310872', donorId === '2714034' ? 'active' : 'inactive'),
          }
        }

        const active = parsedUrl.searchParams.get('active') === 'True'
        return {
          response: new Response(),
          text: donorRow('310872', active ? '2714034' : '2714999'),
        }
      }),
    }

    const result = await findExistingRedwoodDonorMatchesViaHttp({
      accountNumbers: ['310872'],
      client: {
        dob: '1990-01-01',
        firstName: 'Bob',
        lastName: 'Testing',
        middleInitial: 'F',
      },
      donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
      session: session as never,
    })

    expect(result.active).toMatchObject({
      activeStatus: 'active',
      donorId: '2714034',
    })
    expect(result.inactive).toMatchObject({
      activeStatus: 'inactive',
      donorId: '2714999',
    })
  })

  it('requires manual review when two different search rows both verify as active donors', async () => {
    const session = {
      getText: vi.fn(async (url: string) => {
        const parsedUrl = new URL(url)
        if (parsedUrl.pathname.endsWith('/editDonor.aspx')) {
          return {
            response: new Response(),
            text: donorEditForm('310872', 'active'),
          }
        }

        return {
          response: new Response(),
          text: donorRow('310872', parsedUrl.searchParams.get('active') === 'True' ? '2714034' : '2714999'),
        }
      }),
    }

    await expect(
      findExistingRedwoodDonorMatchesViaHttp({
        accountNumbers: ['310872'],
        client: {
          dob: '1990-01-01',
          firstName: 'Bob',
          lastName: 'Testing',
          middleInitial: 'F',
        },
        donorSearchUrl: 'https://toxaccess.example.test/Pages/User/DonorSearch.aspx',
        session: session as never,
      }),
    ).rejects.toThrow('active donor 2714034')
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

    expect(() => assertRedwoodDonorAccountAllowed(html, '2714034')).toThrow('not in REDWOOD_ALLOWED_ACCOUNT_NUMBERS')
  })
})

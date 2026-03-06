import { describe, expect, it } from 'vitest'

import { buildRedwoodImportCSV, findRedwoodDonorMatch, parseRedwoodExport } from '@/lib/redwood/csv'

describe('parseRedwoodExport + findRedwoodDonorMatch', () => {
  const csv = [
    '"Unique ID","Email Address","First Name","Middle Initial","Last Name","Date of Birth"',
    '"ABC123","jane@example.com","Jane","Q","Doe","1988-04-03"',
    '"XYZ789","sam@example.com","Sam","","Stone","04/21/1990"',
  ].join('\n')

  it('matches by unique ID first', () => {
    const donors = parseRedwoodExport(csv)
    const match = findRedwoodDonorMatch(donors, {
      uniqueId: 'ABC123',
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1988-04-03',
    })

    expect(match?.matchedBy).toBe('unique-id')
    expect(match?.donor.email).toBe('jane@example.com')
  })

  it('matches by name + DOB when unique ID misses', () => {
    const donors = parseRedwoodExport(csv)
    const match = findRedwoodDonorMatch(donors, {
      uniqueId: 'MISSING',
      firstName: 'Sam',
      lastName: 'Stone',
      dob: '1990-04-21',
    })

    expect(match?.matchedBy).toBe('name-dob')
  })

  it('returns null when no donor matches', () => {
    const donors = parseRedwoodExport(csv)
    const match = findRedwoodDonorMatch(donors, {
      uniqueId: 'NOPE',
      firstName: 'Nobody',
      lastName: 'Else',
      dob: '2000-01-01',
    })

    expect(match).toBeNull()
  })
})

describe('buildRedwoodImportCSV', () => {
  it('builds a CSV row with expected columns and escaped values', () => {
    const csv = buildRedwoodImportCSV({
      accountNumber: '310872',
      firstName: 'Michael',
      middleInitial: 'J',
      lastName: 'Babbitt',
      uniqueId: '68E51E5A5CB1AA425ABC',
      dob: '1975-02-28',
      sex: 'M',
      group: '',
      phoneNumber: '123-456-7891',
    })

    expect(csv).toContain('"Account Number"')
    expect(csv).toContain('"Unique ID"')
    expect(csv).toContain('"Intake Date"')
    expect(csv).toContain('"68E51E5A5CB1AA425ABC"')
    expect(csv).toContain('"02/28/1975"')
  })
})

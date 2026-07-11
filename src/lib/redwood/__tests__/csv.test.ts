import { describe, expect, it } from 'vitest'

import {
  buildRedwoodImportCSV,
  parseCSVRows,
} from '@/lib/redwood/csv'

describe('buildRedwoodImportCSV', () => {
  it('builds a CSV row with expected columns and escaped values', () => {
    const csv = buildRedwoodImportCSV({
      accountNumber: '310872',
      firstName: 'Avery',
      middleInitial: 'J',
      lastName: 'Example',
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

    const [headers, row] = parseCSVRows(csv)
    expect(row).toHaveLength(headers.length)
    expect(row[1]).toBe('Avery')
    expect(row[2]).toBe('J')
    expect(row[3]).toBe('Example')
  })

  it('preserves ISO datetime DOB strings without timezone shifting', () => {
    const csv = buildRedwoodImportCSV({
      accountNumber: '310974',
      firstName: 'Bob',
      middleInitial: 'F',
      lastName: 'Testing',
      uniqueId: '188644EA193203374B5B',
      dob: '1982-03-13T00:00:00.000Z',
    })

    expect(csv).toContain('"03/13/1982"')
  })
})

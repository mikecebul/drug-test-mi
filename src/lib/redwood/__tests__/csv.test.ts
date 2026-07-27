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
      dob: '1975-02-28',
      sex: 'M',
      group: '',
      phoneNumber: '123-456-7891',
    })

    expect(csv).toContain('"Account Number"')
    expect(csv).toContain('"Unique ID"')
    expect(csv).toContain('"Intake Date"')
    expect(csv).toContain('"02/28/1975"')

    const [headers, row] = parseCSVRows(csv)
    expect(row).toHaveLength(headers.length)
    expect(row[1]).toBe('Avery')
    expect(row[2]).toBe('J')
    expect(row[3]).toBe('Example')
    expect(row[4]).toBe('')

    const dataRow = csv.trim().split('\n')[1]
    expect(dataRow).toContain('"Example",,"02/28/1975"')
    expect(dataRow).not.toContain('"Example","","02/28/1975"')
    expect(dataRow).not.toContain('&quot;')
  })

  it('preserves ISO datetime DOB strings without timezone shifting', () => {
    const csv = buildRedwoodImportCSV({
      accountNumber: '310974',
      firstName: 'Bob',
      middleInitial: 'F',
      lastName: 'Testing',
      dob: '1982-03-13T00:00:00.000Z',
    })

    expect(csv).toContain('"03/13/1982"')
  })
})

import { describe, expect, it } from 'vitest'

import { getRedwoodFormEntry, parseRedwoodFormEntries, setRedwoodFormEntry } from '@/lib/redwood/http'

describe('redwood HTTP helpers', () => {
  it('parses successful WebForms controls without submit buttons or unchecked radios', () => {
    const entries = parseRedwoodFormEntries(`
      <form enctype="multipart/form-data">
        <input type="hidden" name="__VIEWSTATE" value="/wEPDw&amp;test" />
        <input type="text" name="ctl00$PageContent$Donor$txtFirstName" value="Bob" />
        <input type="radio" name="ctl00$PageContent$Donor$sex" value="rdbMale" checked="checked" />
        <input type="radio" name="ctl00$PageContent$Donor$sex" value="rdbFemale" />
        <input type="checkbox" name="checkedDefault" checked="checked" />
        <input type="checkbox" name="unchecked" value="on" />
        <input type="submit" name="ctl00$PageContent$Donor$btnsave" value="Save" />
        <select name="ctl00$PageContent$Donor$ddlAgencies">
          <option value="310872">MI Drug Test llc - MI</option>
          <option value="310974" selected="selected">MI Drug Test</option>
        </select>
        <textarea name="notes">A&amp;B</textarea>
      </form>
    `)

    expect(getRedwoodFormEntry(entries, '__VIEWSTATE')).toBe('/wEPDw&test')
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$txtFirstName')).toBe('Bob')
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$sex')).toBe('rdbMale')
    expect(getRedwoodFormEntry(entries, 'checkedDefault')).toBe('on')
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$btnsave')).toBeUndefined()
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$ddlAgencies')).toBe('310974')
    expect(getRedwoodFormEntry(entries, 'notes')).toBe('A&B')
  })

  it('updates existing entries and appends missing entries', () => {
    const entries: [string, string][] = [['first', 'Bob']]

    expect(setRedwoodFormEntry(entries, 'first', 'Robert')).toBe(true)
    expect(setRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$btnsave', 'Save')).toBe(false)

    expect(entries).toEqual([
      ['first', 'Robert'],
      ['ctl00$PageContent$Donor$btnsave', 'Save'],
    ])
  })
})

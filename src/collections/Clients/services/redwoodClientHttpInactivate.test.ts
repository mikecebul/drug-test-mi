import { describe, expect, it } from 'vitest'

import { getRedwoodFormEntry } from '@/lib/redwood/http'
import {
  buildRedwoodDonorInactivationPlan,
  readRedwoodDonorActiveStatus,
} from './redwoodClientHttpInactivate'

const activeDonorFormHtml = `
  <form>
    <input type="hidden" name="__VIEWSTATE" value="state" />
    <input id="PageContent_Donor_rdbActive" type="radio"
      name="ctl00$PageContent$Donor$Active" value="rdbActive" checked="checked" />
    <input id="PageContent_Donor_rdbInActive" type="radio"
      name="ctl00$PageContent$Donor$Active" value="rdbInActive" />
  </form>
`

describe('redwood HTTP donor inactivation helpers', () => {
  it('reads active status from the donor edit radio group', () => {
    expect(readRedwoodDonorActiveStatus(activeDonorFormHtml)).toBe('active')
    expect(
      readRedwoodDonorActiveStatus(`
        <input id="PageContent_Donor_rdbInActive" type="radio"
          name="ctl00$PageContent$Donor$Active" value="rdbInActive" checked="checked" />
      `),
    ).toBe('inactive')
  })

  it('sets the active radio group to inactive', () => {
    const plan = buildRedwoodDonorInactivationPlan(activeDonorFormHtml)

    expect(plan.alreadyInactive).toBe(false)
    expect(getRedwoodFormEntry(plan.entries, 'ctl00$PageContent$Donor$Active')).toBe('rdbInActive')
  })

  it('throws when the donor edit page does not expose active controls', () => {
    expect(() => buildRedwoodDonorInactivationPlan('<form></form>')).toThrow(
      'Redwood donor edit page did not expose the active/inactive field.',
    )
  })
})

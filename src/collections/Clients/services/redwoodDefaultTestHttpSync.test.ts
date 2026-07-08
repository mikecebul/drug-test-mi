import { describe, expect, it } from 'vitest'

import { getRedwoodFormEntry } from '@/lib/redwood/http'
import {
  buildRedwoodDefaultTestSelectionPlan,
  readRedwoodDefaultTestSelectionState,
} from './redwoodDefaultTestHttpSync'

const defaultTestFormHtml = `
  <form>
    <input type="hidden" name="__VIEWSTATE" value="state" />
    <table id="PageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection">
      <tbody>
        <tr class="tableText">
          <td>
            <input id="chkSelectedTest" type="checkbox"
              name="ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$gvTestSelection$ctl02$chkSelectedTest"
              checked="checked" />
            <input type="hidden"
              name="ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$gvTestSelection$ctl02$hiddenTestCode"
              value="B729" />
          </td>
          <td>Urine 11 Panel</td>
          <td>B729</td>
        </tr>
        <tr class="tableText">
          <td>
            <input id="chkSelectedTest" type="checkbox"
              name="ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$gvTestSelection$ctl03$chkSelectedTest" />
            <input type="hidden"
              name="ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$gvTestSelection$ctl03$hiddenTestCode"
              value="B829" />
          </td>
          <td>Urine 12 Panel</td>
          <td>B829</td>
        </tr>
      </tbody>
    </table>
    <input type="hidden"
      name="ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$hiddenSelectedTests"
      value="B729" />
  </form>
`

describe('redwood HTTP default-test helpers', () => {
  it('reads available and selected default-test codes from the donor edit form', () => {
    expect(readRedwoodDefaultTestSelectionState(defaultTestFormHtml)).toEqual({
      availableCodes: ['B729', 'B829'],
      selectedCodes: ['B729'],
    })
  })

  it('adds a changed default-test code while preserving existing selected codes', () => {
    const plan = buildRedwoodDefaultTestSelectionPlan(defaultTestFormHtml, 'b829')

    expect(plan.targetAlreadySelected).toBe(false)
    expect(plan.nextSelectedCodes).toEqual(['B729', 'B829'])
    expect(getRedwoodFormEntry(plan.entries, 'ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$hiddenSelectedTests')).toBe(
      'B729||B829',
    )
    expect(
      getRedwoodFormEntry(
        plan.entries,
        'ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$gvTestSelection$ctl03$chkSelectedTest',
      ),
    ).toBe('on')
  })

  it('replaces the last website-managed default-test code while preserving other selected codes', () => {
    const plan = buildRedwoodDefaultTestSelectionPlan(defaultTestFormHtml, 'b829', 'B729')

    expect(plan.targetAlreadySelected).toBe(false)
    expect(plan.selectionChanged).toBe(true)
    expect(plan.nextSelectedCodes).toEqual(['B829'])
    expect(getRedwoodFormEntry(plan.entries, 'ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$hiddenSelectedTests')).toBe(
      'B829',
    )
    expect(
      getRedwoodFormEntry(
        plan.entries,
        'ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$gvTestSelection$ctl02$chkSelectedTest',
      ),
    ).toBeUndefined()
  })

  it('detects already selected default-test codes without changing the selection set', () => {
    const plan = buildRedwoodDefaultTestSelectionPlan(defaultTestFormHtml, 'B729')

    expect(plan.targetAlreadySelected).toBe(true)
    expect(plan.nextSelectedCodes).toEqual(['B729'])
  })

  it('throws with available codes when the target default-test code is missing', () => {
    expect(() => buildRedwoodDefaultTestSelectionPlan(defaultTestFormHtml, 'P40')).toThrow(
      'Redwood donor default-test code "P40" was not found. Available codes: B729, B829',
    )
  })
})

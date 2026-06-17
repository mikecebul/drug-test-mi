import { describe, expect, test } from 'vitest'

import {
  DRUG_TEST_CAL_LINK,
  getAdminQuickBookCalLink,
  LCEMS_DRUG_TEST_CAL_LINK,
  UNPAID_BOOKING_CAL_LINK,
} from '@/utilities/calcom-config'

describe('Cal.com config helpers', () => {
  test('uses the unpaid drug-test event for regular admin quick bookings', () => {
    expect(getAdminQuickBookCalLink()).toBe(DRUG_TEST_CAL_LINK)
    expect(getAdminQuickBookCalLink({ referralType: 'court', referralName: '57th District Court' })).toBe(
      DRUG_TEST_CAL_LINK,
    )
    expect(getAdminQuickBookCalLink({ referralType: 'employer', referralName: 'Some Employer' })).toBe(
      DRUG_TEST_CAL_LINK,
    )
    expect(UNPAID_BOOKING_CAL_LINK).toBe(DRUG_TEST_CAL_LINK)
  })

  test('uses the LCEMS event for Lake Charlevoix EMS employer referrals', () => {
    expect(getAdminQuickBookCalLink({ referralType: 'employer', referralName: 'LCEMS' })).toBe(
      LCEMS_DRUG_TEST_CAL_LINK,
    )
    expect(
      getAdminQuickBookCalLink({
        referralType: 'employer',
        referralName: 'LCEMS (Lake Charlevoix EMS)',
      }),
    ).toBe(LCEMS_DRUG_TEST_CAL_LINK)
  })
})

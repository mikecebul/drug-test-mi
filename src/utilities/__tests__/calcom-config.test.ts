import { describe, expect, test } from 'vitest'

import {
  buildClientBookingCalConfig,
  DRUG_TEST_CAL_LINK,
  getAdminQuickBookCalLink,
  LCEMS_DRUG_TEST_CAL_LINK,
  UNPAID_BOOKING_CAL_LINK,
} from '@/utilities/calcom-config'
import type { Client } from '@/payload-types'

function createClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-id',
    firstName: ' Taylor ',
    lastName: ' Client ',
    email: ' taylor@example.com ',
    phone: '(231) 555-1212',
    referralType: 'self',
    allowUnpaidBookings: false,
    createdAt: '2026-06-17T12:00:00.000Z',
    updatedAt: '2026-06-17T12:00:00.000Z',
    ...overrides,
  } as Client
}

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

  test('builds client booking config with trimmed name, email, and formatted phone', async () => {
    await expect(buildClientBookingCalConfig(createClient())).resolves.toMatchObject({
      name: 'Taylor Client',
      email: 'taylor@example.com',
      attendeePhoneNumber: '+12315551212',
    })
  })

  test('adds referral title and preferred booking label when populated', async () => {
    const config = await buildClientBookingCalConfig(
      createClient({
        referralType: 'employer',
        referral: {
          relationTo: 'employers',
          value: {
            id: 'employer-id',
            name: 'Acme Testing',
            preferredTestType: {
              id: 'test-type-id',
              value: '11-panel-lab-no-etg',
              label: 'Internal Label',
              bookingLabel: 'Court Ordered Lab',
            },
          },
        },
      } as Partial<Client>),
    )

    expect(config).toMatchObject({
      title: 'Acme Testing',
      test: 'Court Ordered Lab',
    })
  })

  test('falls back to recommended test labels for known preferred test values', async () => {
    const config = await buildClientBookingCalConfig(
      createClient({
        referralType: 'court',
        referral: {
          relationTo: 'courts',
          value: {
            id: 'court-id',
            name: '57th District Court',
            preferredTestType: {
              id: 'test-type-id',
              value: '17-panel-instant',
            },
          },
        },
      } as Partial<Client>),
    )

    expect(config.test).toBe('17 Panel Instant')
  })

  test('omits invalid phone numbers from booking config', async () => {
    await expect(buildClientBookingCalConfig(createClient({ phone: '555-1212' }))).resolves.not.toHaveProperty(
      'attendeePhoneNumber',
    )
  })
})

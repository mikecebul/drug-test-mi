import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import type { Client } from '@/payload-types'
import { DashboardView, type DashboardData } from '../DashboardView'

vi.mock('@/components/cal-popup-button', () => ({
  CalPopupButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}))

function createDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  const client = {
    id: 'client-1',
    firstName: 'Taylor',
    lastName: 'Client',
    email: 'taylor@example.com',
    phone: '2315550199',
    referralType: 'self',
    allowUnpaidBookings: false,
  } as Client

  return {
    user: {
      id: 'client-1',
      name: 'Taylor Client',
      email: 'taylor@example.com',
      referralType: 'self',
      isActive: true,
    },
    client,
    stats: {
      totalTests: 1,
      compliantTests: 1,
      complianceRate: 100,
      activeMedications: 0,
      activeMedicationNames: [],
      pendingTests: 0,
    },
    nextAppointment: {
      date: '2026-07-02T14:00:00.000Z',
      type: 'Drug Test Appointment',
      calcomBookingId: 'booking-uid',
      calcomActionLinks: {
        cancelHref: 'https://cal.com/booking/booking-uid?cancel=true',
        rescheduleHref: 'https://cal.com/reschedule/booking-uid',
      },
    },
    ...overrides,
  }
}

describe('DashboardView', () => {
  test('renders Cal.com reschedule and cancel actions on the next appointment card', () => {
    const markup = renderToStaticMarkup(<DashboardView data={createDashboardData()} />)

    expect(markup).toContain('Next Appointment')
    expect(markup).toContain('Reschedule')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('https://cal.com/reschedule/booking-uid')
    expect(markup).toContain('https://cal.com/booking/booking-uid?cancel=true')
  })

  test('falls back to booking UID action links when explicit action links are not provided', () => {
    const markup = renderToStaticMarkup(
      <DashboardView
        data={createDashboardData({
          nextAppointment: {
            date: '2026-07-02T14:00:00.000Z',
            type: 'Drug Test Appointment',
            calcomBookingId: 'fallback-booking',
          },
        })}
      />,
    )

    expect(markup).toContain('https://cal.com/reschedule/fallback-booking')
    expect(markup).toContain('https://cal.com/booking/fallback-booking?cancel=true')
  })
})

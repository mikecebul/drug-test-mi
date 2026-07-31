import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mockGetTodaysCollectionBookings = vi.hoisted(() => vi.fn())

import AdminQuickBookWidget from '@/views/dashboard/widgets/AdminQuickBookWidget'
import AdminAlertsWidget from '@/views/dashboard/widgets/AdminAlertsWidget'
import NextCalcomBookingWidget from '@/views/dashboard/widgets/NextCalcomBookingWidget'
import PendingDrugTestsWidget from '@/views/dashboard/widgets/PendingDrugTestsWidget'
import RandomTestingSyncWidget from '@/views/dashboard/widgets/RandomTestingSyncWidget'
import RedwoodQueueProbeWidget from '@/views/dashboard/widgets/RedwoodQueueProbeWidget'
import TotalClientsWidget from '@/views/dashboard/widgets/TotalClientsWidget'
import WizardEntryWidget from '@/views/dashboard/widgets/WizardEntryWidget'

type WidgetReq = Parameters<typeof WizardEntryWidget>[0]['req']
type WidgetProps = Parameters<typeof WizardEntryWidget>[0]

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/views/dashboard/widgets/AdminQuickBookWidget.client', () => ({
  AdminQuickBookWidgetClient: () => <div>Quick Book Client</div>,
}))

vi.mock('@/views/dashboard/widgets/RedwoodQueueProbeWidget.client', () => ({
  RedwoodQueueProbeWidgetClient: () => <div>Redwood Queue Probe Client</div>,
}))

vi.mock('@/views/dashboard/widgets/RandomTestingSyncWidget.client', () => ({
  RandomTestingSyncWidgetClient: () => <div>Random Testing Sync Client</div>,
}))

vi.mock('@/views/DrugTestWizard/workflows/complete-workflow/actions', () => ({
  getTodaysCollectionBookings: mockGetTodaysCollectionBookings,
}))

function renderMarkup(node: React.ReactNode) {
  return renderToStaticMarkup(<>{node}</>)
}

function createAdminReq(): WidgetReq {
  return {
    user: {
      collection: 'admins',
    },
    payload: {
      count: vi.fn(),
      find: vi.fn(),
      logger: {
        error: vi.fn(),
      },
    },
  } as unknown as WidgetReq
}

function createWidgetProps(req: WidgetReq, widgetSlug: string): WidgetProps {
  return {
    req,
    widgetSlug,
  } as WidgetProps
}

describe('dashboard widgets', () => {
  test('renders admin card variant styles for all dashboard cards', async () => {
    mockGetTodaysCollectionBookings.mockResolvedValue([])

    const wizardReq = createAdminReq()
    const wizardMarkup = renderMarkup(WizardEntryWidget(createWidgetProps(wizardReq, 'wizard-entry')))

    const totalReq = createAdminReq()
    ;(totalReq.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 12 })
    const totalMarkup = renderMarkup(await TotalClientsWidget(createWidgetProps(totalReq, 'total-clients')))

    const quickBookReq = createAdminReq()
    const quickBookMarkup = renderMarkup(AdminQuickBookWidget(createWidgetProps(quickBookReq, 'admin-quick-book')))

    const probeReq = createAdminReq()
    const probeMarkup = renderMarkup(RedwoodQueueProbeWidget(createWidgetProps(probeReq, 'redwood-queue-probe')))

    const randomTestingReq = createAdminReq()
    const randomTestingMarkup = renderMarkup(
      RandomTestingSyncWidget(createWidgetProps(randomTestingReq, 'random-testing-sync')),
    )

    const scheduleReq = createAdminReq()
    const scheduleMarkup = renderMarkup(
      await NextCalcomBookingWidget(createWidgetProps(scheduleReq, 'next-calcom-booking')),
    )

    const pendingReq = createAdminReq()
    ;(pendingReq.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 3 })
    const pendingMarkup = renderMarkup(
      await PendingDrugTestsWidget(createWidgetProps(pendingReq, 'pending-drug-tests')),
    )

    const alertsReq = createAdminReq()
    mockGetTodaysCollectionBookings.mockResolvedValue([])
    ;(alertsReq.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 0 })
    const alertsMarkup = renderMarkup(await AdminAlertsWidget(createWidgetProps(alertsReq, 'admin-alerts')))

    expect(wizardMarkup).toContain('bg-gradient-to-b')
    expect(totalMarkup).toContain('bg-gradient-to-b')
    expect(quickBookMarkup).toContain('bg-gradient-to-b')
    expect(probeMarkup).toContain('bg-gradient-to-b')
    expect(randomTestingMarkup).toContain('bg-gradient-to-b')
    expect(scheduleMarkup).toContain('bg-gradient-to-b')
    expect(pendingMarkup).toContain('bg-gradient-to-b')
    expect(alertsMarkup).toContain('bg-gradient-to-b')
  })

  test('renders the Redwood queue probe diagnostic widget for admins', () => {
    const req = createAdminReq()
    const markup = renderMarkup(RedwoodQueueProbeWidget(createWidgetProps(req, 'redwood-queue-probe')))

    expect(markup).toContain('Redwood Queue Probe')
    expect(markup).toContain('website can enqueue work')
    expect(markup).toContain('Redwood Queue Probe Client')
  })

  test('renders the random-testing sync controls for admins', () => {
    const req = createAdminReq()
    const markup = renderMarkup(RandomTestingSyncWidget(createWidgetProps(req, 'random-testing-sync')))

    expect(markup).toContain('Random Testing Sync')
    expect(markup).toContain('same jobs used by production cron')
    expect(markup).toContain('Random Testing Sync Client')
  })

  test('renders dashboard register link in total clients widget', async () => {
    const req = createAdminReq()
    ;(req.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 5 })

    const markup = renderMarkup(await TotalClientsWidget(createWidgetProps(req, 'total-clients')))

    expect(markup).toContain('/admin/drug-test-upload?workflow=register-client')
    expect(markup).toContain('returnTo=dashboard')
    expect(markup).toContain('Register New Client')
  })

  test('renders quick book heading', () => {
    const req = createAdminReq()
    const markup = renderMarkup(AdminQuickBookWidget(createWidgetProps(req, 'admin-quick-book')))

    expect(markup).toContain('Quick Book')
    expect(markup).toContain('Book an existing client or start a clean appointment.')
  })

  test('renders guided schedule rows that jump into the selected booking workflow', async () => {
    const req = createAdminReq()
    mockGetTodaysCollectionBookings.mockResolvedValue([
      {
        id: 'booking-1',
        attendeeName: 'Jamie Client',
        startTime: '2026-05-24T14:30:00.000Z',
        gender: 'female',
        client: null,
        payment: null,
        sampleCollection: null,
        needsRegistration: true,
        needsTestType: false,
        calcomActionLinks: {
          cancelHref: null,
          rescheduleHref: null,
        },
      },
      {
        id: 'booking-2',
        attendeeName: 'Morgan Ready',
        startTime: '2026-05-24T15:30:00.000Z',
        gender: 'male',
        client: {
          gender: 'male',
        },
        payment: {
          status: 'paid',
          method: 'pre-paid',
        },
        sampleCollection: null,
        needsRegistration: false,
        needsTestType: false,
        calcomActionLinks: {
          cancelHref: 'https://cal.com/booking/cal-booking-2?cancel=true',
          rescheduleHref: 'https://cal.com/reschedule/cal-booking-2',
        },
      },
    ])

    const markup = renderMarkup(await NextCalcomBookingWidget(createWidgetProps(req, 'next-calcom-booking')))

    expect(markup).toContain('Today&#x27;s Schedule')
    expect(markup).toContain('2 tests scheduled today.')
    expect(markup).toContain('Menu')
    expect(markup).toContain('Collect Test')
    expect(markup).toContain('/admin/drug-test-upload')
    expect(markup).toContain('Jamie Client')
    expect(markup).toContain('bg-pink-50')
    expect(markup).toContain('text-pink-900')
    expect(markup).toContain('bg-blue-50')
    expect(markup).toContain('text-blue-900')
    expect(markup).toContain('Register')
    expect(markup).toContain('Review &amp; Start')
    expect(markup).toContain('appointment options')
    expect(markup).toContain('lucide-ellipsis')
    expect(markup).toContain('grid-cols-[minmax(0,1fr)_auto]')
    expect(markup).toContain('flex-wrap')
    expect(markup).toContain('p-3')
    expect(markup).toContain('/admin/drug-test-upload?workflow=guided&amp;step=review&amp;bookingId=booking-1')
    expect(markup).toContain('/admin/drug-test-upload?workflow=guided&amp;step=review&amp;bookingId=booking-2')
  })

  test('renders completed schedule rows as inactive and prevents collection actions', async () => {
    const req = createAdminReq()
    mockGetTodaysCollectionBookings.mockResolvedValue([
      {
        id: 'booking-completed',
        attendeeName: 'Melissa Helsley',
        startTime: '2026-05-24T15:30:00.000Z',
        client: {
          gender: 'female',
        },
        payment: {
          status: 'paid',
          method: 'pre-paid',
        },
        sampleCollection: {
          status: 'collected',
        },
        needsRegistration: false,
        needsTestType: false,
        calcomActionLinks: {
          cancelHref: 'https://cal.com/booking/completed?cancel=true',
          rescheduleHref: 'https://cal.com/reschedule/completed',
        },
      },
    ])

    const markup = renderMarkup(await NextCalcomBookingWidget(createWidgetProps(req, 'next-calcom-booking')))

    expect(markup).toContain('Completed')
    expect(markup).toContain('line-through')
    expect(markup).toContain('bg-muted/40')
    expect(markup).toContain('opacity-60')
    expect(markup).toContain('grayscale')
    expect(markup).not.toContain('Collect Test')
    expect(markup).not.toContain('Review &amp; Start')
    expect(markup).not.toContain('bookingId=booking-completed')
    expect(markup).not.toContain('https://cal.com/reschedule/completed')
    expect(markup).not.toContain('https://cal.com/booking/completed?cancel=true')
  })

  test('describes the wizard widget as manual collection and lab result work', () => {
    const req = createAdminReq()
    const markup = renderMarkup(WizardEntryWidget(createWidgetProps(req, 'wizard-entry')))

    expect(markup).toContain('Manually collect unscheduled samples')
    expect(markup).toContain('lab screen and confirmation results')
  })

  test('hides widgets for non-admin users', async () => {
    const req = createAdminReq()
    ;(req.user as { collection: string }).collection = 'clients'

    const totalMarkup = renderMarkup(await TotalClientsWidget(createWidgetProps(req, 'total-clients')))
    const quickBookMarkup = renderMarkup(AdminQuickBookWidget(createWidgetProps(req, 'admin-quick-book')))
    const alertsMarkup = renderMarkup(await AdminAlertsWidget(createWidgetProps(req, 'admin-alerts')))

    expect(totalMarkup).toBe('')
    expect(quickBookMarkup).toBe('')
    expect(alertsMarkup).toBe('')
  })

  test('renders pending test breakdown including confirmation decisions', async () => {
    const req = createAdminReq()
    ;(req.payload.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ totalDocs: 5 })
      .mockResolvedValueOnce({ totalDocs: 1 })
      .mockResolvedValueOnce({ totalDocs: 2 })
      .mockResolvedValueOnce({ totalDocs: 1 })
      .mockResolvedValueOnce({ totalDocs: 2 })

    const markup = renderMarkup(await PendingDrugTestsWidget(createWidgetProps(req, 'pending-drug-tests')))

    expect(markup).toContain('Pending Tests')
    expect(markup).toContain('5 tests need follow-up')
    expect(markup).toContain('Awaiting screening')
    expect(markup).toContain('Awaiting decision')
    expect(markup).toContain('Awaiting payment')
    expect(markup).toContain('Pending confirmation')
    expect(req.payload.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          or: [
            {
              isComplete: {
                equals: false,
              },
            },
            {
              'payment.balanceDue': {
                greater_than: 0,
              },
            },
          ],
        },
      }),
    )
    expect(req.payload.count).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: {
          'payment.balanceDue': {
            greater_than: 0,
          },
        },
      }),
    )
  })

  test('admin alerts ignore normal new-client registration and pending decisions', async () => {
    const req = createAdminReq()
    mockGetTodaysCollectionBookings.mockResolvedValue([
      {
        id: 'booking-1',
        attendeeName: 'Jamie Client',
        startTime: '2026-05-24T14:30:00.000Z',
        client: null,
        payment: null,
        sampleCollection: null,
        needsRegistration: true,
        needsTestType: false,
        calcomActionLinks: {
          cancelHref: null,
          rescheduleHref: null,
        },
      },
    ])

    const markup = renderMarkup(await AdminAlertsWidget(createWidgetProps(req, 'admin-alerts')))

    expect(markup).toContain('Admin Alerts')
    expect(markup).toContain('No admin alerts right now.')
    expect(markup).not.toContain('Bookings need registration')
    expect(markup).not.toContain('Tests waiting on confirmation decision')
    expect(req.payload.count).not.toHaveBeenCalled()
  })

  test('admin alerts show bookings that need test type review', async () => {
    const req = createAdminReq()
    mockGetTodaysCollectionBookings.mockResolvedValue([
      {
        id: 'booking-1',
        attendeeName: 'Jamie Client',
        startTime: '2026-05-24T14:30:00.000Z',
        client: {
          gender: 'female',
        },
        payment: null,
        sampleCollection: null,
        needsRegistration: false,
        needsTestType: true,
        calcomActionLinks: {
          cancelHref: null,
          rescheduleHref: null,
        },
      },
    ])

    const markup = renderMarkup(await AdminAlertsWidget(createWidgetProps(req, 'admin-alerts')))

    expect(markup).toContain('Bookings need test type review')
  })
})

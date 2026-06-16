import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mockGetTodaysCollectionBookings = vi.hoisted(() => vi.fn())

import AdminQuickBookWidget from '@/views/dashboard/widgets/AdminQuickBookWidget'
import AdminAlertsWidget from '@/views/dashboard/widgets/AdminAlertsWidget'
import NextCalcomBookingWidget from '@/views/dashboard/widgets/NextCalcomBookingWidget'
import PendingDrugTestsWidget from '@/views/dashboard/widgets/PendingDrugTestsWidget'
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
    const quickBookMarkup = renderMarkup(
      AdminQuickBookWidget(createWidgetProps(quickBookReq, 'admin-quick-book')),
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
    expect(scheduleMarkup).toContain('bg-gradient-to-b')
    expect(pendingMarkup).toContain('bg-gradient-to-b')
    expect(alertsMarkup).toContain('bg-gradient-to-b')
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
        client: {
          gender: 'female',
        },
        payment: null,
        sampleCollection: null,
        needsRegistration: true,
        needsTestType: false,
      },
      {
        id: 'booking-2',
        attendeeName: 'Morgan Ready',
        startTime: '2026-05-24T15:30:00.000Z',
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
      },
    ])

    const markup = renderMarkup(await NextCalcomBookingWidget(createWidgetProps(req, 'next-calcom-booking')))

    expect(markup).toContain('Today&#x27;s Schedule')
    expect(markup).toContain('2 tests scheduled today.')
    expect(markup).toContain('Collect Test')
    expect(markup).toContain('/admin/drug-test-upload')
    expect(markup).toContain('Jamie Client')
    expect(markup).toContain('Register')
    expect(markup).toContain('Start Guided Workflow')
    expect(markup).toContain(
      '/admin/drug-test-upload?workflow=guided&amp;step=registration&amp;bookingId=booking-1',
    )
    expect(markup).toContain(
      '/admin/drug-test-upload?workflow=guided&amp;step=payment&amp;bookingId=booking-2',
    )
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
    const quickBookMarkup = renderMarkup(
      AdminQuickBookWidget(createWidgetProps(req, 'admin-quick-book')),
    )
    const alertsMarkup = renderMarkup(await AdminAlertsWidget(createWidgetProps(req, 'admin-alerts')))

    expect(totalMarkup).toBe('')
    expect(quickBookMarkup).toBe('')
    expect(alertsMarkup).toBe('')
  })

  test('renders admin alerts for missing schedule setup and pending decisions', async () => {
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
      },
    ])
    ;(req.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 2 })

    const markup = renderMarkup(await AdminAlertsWidget(createWidgetProps(req, 'admin-alerts')))

    expect(markup).toContain('Admin Alerts')
    expect(markup).toContain('Bookings need registration or test type review')
    expect(markup).toContain('Tests waiting on confirmation decision')
  })
})

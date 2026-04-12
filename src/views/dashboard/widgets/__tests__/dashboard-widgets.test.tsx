import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import AdminQuickBookWidget from '@/views/dashboard/widgets/AdminQuickBookWidget'
import NextCalcomBookingWidget from '@/views/dashboard/widgets/NextCalcomBookingWidget'
import PendingDrugTestsWidget from '@/views/dashboard/widgets/PendingDrugTestsWidget'
import TotalClientsWidget from '@/views/dashboard/widgets/TotalClientsWidget'
import WizardEntryWidget from '@/views/dashboard/widgets/WizardEntryWidget'

type WidgetReq = Parameters<typeof WizardEntryWidget>[0]['req']

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

describe('dashboard widgets', () => {
  test('renders admin card variant styles for all dashboard cards', async () => {
    const wizardReq = createAdminReq()
    const wizardMarkup = renderMarkup(WizardEntryWidget({ req: wizardReq }))

    const totalReq = createAdminReq()
    ;(totalReq.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 12 })
    const totalMarkup = renderMarkup(await TotalClientsWidget({ req: totalReq }))

    const quickBookReq = createAdminReq()
    const quickBookMarkup = renderMarkup(AdminQuickBookWidget({ req: quickBookReq }))

    const scheduleReq = createAdminReq()
    ;(scheduleReq.payload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })
    const scheduleMarkup = renderMarkup(await NextCalcomBookingWidget({ req: scheduleReq }))

    const pendingReq = createAdminReq()
    ;(pendingReq.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 3 })
    const pendingMarkup = renderMarkup(await PendingDrugTestsWidget({ req: pendingReq }))

    expect(wizardMarkup).toContain('bg-gradient-to-b')
    expect(totalMarkup).toContain('bg-gradient-to-b')
    expect(quickBookMarkup).toContain('bg-gradient-to-b')
    expect(scheduleMarkup).toContain('bg-gradient-to-b')
    expect(pendingMarkup).toContain('bg-gradient-to-b')
  })

  test('renders dashboard register link in total clients widget', async () => {
    const req = createAdminReq()
    ;(req.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 5 })

    const markup = renderMarkup(await TotalClientsWidget({ req }))

    expect(markup).toContain('/admin/drug-test-upload?workflow=register-client')
    expect(markup).toContain('returnTo=dashboard')
    expect(markup).toContain('Register New Client')
  })

  test('renders quick book heading', () => {
    const req = createAdminReq()
    const markup = renderMarkup(AdminQuickBookWidget({ req }))

    expect(markup).toContain('Quick Book')
  })

  test('hides widgets for non-admin users', async () => {
    const req = createAdminReq()
    ;(req.user as { collection: string }).collection = 'clients'

    const totalMarkup = renderMarkup(await TotalClientsWidget({ req }))
    const quickBookMarkup = renderMarkup(AdminQuickBookWidget({ req }))

    expect(totalMarkup).toBe('')
    expect(quickBookMarkup).toBe('')
  })
})

import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import QuickBookLink from '@/views/beforeNavLinks/QuickBookLink'
import DrugTestCollectorLink from '@/views/beforeNavLinks/DrugTestCollectorLink'

vi.mock('@/views/dashboard/widgets/AdminQuickBookWidget.client', () => ({
  AdminQuickBookWidgetClient: ({ searchInputId }: { searchInputId?: string }) => (
    <div data-search-input-id={searchInputId}>Quick Book Client</div>
  ),
}))

describe('QuickBookLink', () => {
  test('opens quick book from a dialog instead of linking to the dashboard hash', () => {
    const markup = renderToStaticMarkup(<QuickBookLink />)

    expect(markup).toContain('Quick Book')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).not.toContain('/admin#admin-quick-book-search')
  })

  test('links collect test to the workflow selector while guided workflow is being migrated', () => {
    const markup = renderToStaticMarkup(<DrugTestCollectorLink />)

    expect(markup).toContain('Collect Test')
    expect(markup).toContain('href="/admin/drug-test-upload"')
    expect(markup).not.toContain('workflow=guided')
  })
})

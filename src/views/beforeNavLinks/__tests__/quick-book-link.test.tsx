import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import QuickBookLink from '@/views/beforeNavLinks/QuickBookLink'

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
})

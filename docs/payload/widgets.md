Defining Widgets
Define widgets in your Payload config using the admin.dashboard.widgets property:

import { buildConfig } from 'payload'

export default buildConfig({
  admin: {
    dashboard: {
      widgets: [
        {
          slug: 'sales-summary',
          Component: './components/SalesSummary.tsx#default',
          fields: [
            { name: 'title', type: 'text' },
            {
              name: 'timeframe',
              type: 'select',
              options: ['daily', 'weekly', 'monthly', 'yearly'],
            },
            { name: 'showTrend', type: 'checkbox' },
          ],
          minWidth: 'small',
          maxWidth: 'medium',
        },
      ],
    },
  },
})
Widget Configuration
Property

Type

Description

slug *

string

Unique identifier for the widget

Component *

string

Path to the widget component (supports # syntax for named exports)

fields

Field[]

Optional widget-specific form fields shown in the edit drawer

minWidth

WidgetWidth

Minimum width the widget can be resized to (default: 'x-small')

maxWidth

WidgetWidth

Maximum width the widget can be resized to (default: 'full')

WidgetWidth Values: 'x-small' | 'small' | 'medium' | 'large' | 'x-large' | 'full'.

Creating a Widget Component
Widgets are React Server Components that receive WidgetServerProps:

import type { WidgetServerProps } from 'payload'

export default async function UserStatsWidget({ req }: WidgetServerProps) {
  const { payload } = req

  // Fetch data server-side
  const userCount = await payload.count({ collection: 'users' })

  return (
    <div className="card">
      <h3>Total Users</h3>
      <p style={{ fontSize: '32px', fontWeight: 'bold' }}>
        {userCount.totalDocs}
      </p>
    </div>
  )
}
For visual consistency with the Payload UI, we recommend:

Using the card class for your root element, unless you don't want it to have a background color.
Using our theme variables for backgrounds and text colors. For example, use var(--theme-elevation-0) for backgrounds and var(--theme-text) for text colors.
Default Layout
Control the initial dashboard layout with the defaultLayout property:

export default buildConfig({
  admin: {
    dashboard: {
      defaultLayout: ({ req }) => {
        // Customize layout based on user role or other factors
        const isAdmin = req.user?.roles?.includes('admin')

        return [
          { widgetSlug: 'collections', width: 'full' },
          {
            widgetSlug: 'sales-summary',
            data: {
              timeframe: 'monthly',
              title: 'Revenue Overview',
            },
            width: isAdmin ? 'medium' : 'small',
          },
          { widgetSlug: 'user-stats', width: isAdmin ? 'medium' : 'full' },
          { widgetSlug: 'revenue-chart', width: 'full' },
        ]
      },
      widgets: [
        // ... widget definitions
      ],
    },
  },
})
The defaultLayout function receives the request object and should return an array of WidgetInstance objects.

If your widget has fields, you can type widgetData with generated widget types:

import type { WidgetServerProps } from 'payload'

import type { SalesSummaryWidget } from '../payload-types'

export default async function SalesSummaryWidgetComponent({
  widgetData,
}: WidgetServerProps<SalesSummaryWidget>) {
  const title = widgetData?.title ?? 'Sales Summary'
  const timeframe = widgetData?.timeframe ?? 'monthly'

  return (
    <div className="card">
      <h3>
        {title} ({timeframe})
      </h3>
    </div>
  )
}
WidgetInstance Type
Property

Type

Description

widgetSlug *

string

Slug of the widget to display

data

object

Optional widget-specific data passed to widgetData

width

WidgetWidth

Initial width of the widget (default: minWidth)

width is constrained by each widget's minWidth and maxWidth when types are generated.

Tip: Users can customize their dashboard layout, which is saved to their preferences. The defaultLayout is only used for first-time visitors or after a layout reset.

Built-in Widgets
Payload includes a built-in collections widget that displays collection and global cards.

If you don't define a defaultLayout, the collections widget will be automatically included in your dashboard.

User Customization
Users can customize their dashboard by:

Clicking the dashboard dropdown in the breadcrumb
Selecting "Edit Dashboard"
Adding widgets via the "Add +" button
Editing widget data (for widgets with fields) via the edit button
Resizing widgets using the width dropdown on each widget (if multiple widths are allowed)
Reordering widgets via drag-and-drop
Deleting widgets using the delete button
Saving changes or canceling to revert
Users can also reset their dashboard to the default layout using the "Reset Layout" option.
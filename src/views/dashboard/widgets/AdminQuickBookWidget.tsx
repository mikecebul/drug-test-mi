import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminQuickBookWidgetClient } from './AdminQuickBookWidget.client'
import { DASHBOARD_WIDGET_CARD_CLASS } from './widget-card-styles'

export default function AdminQuickBookWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card className={`${DASHBOARD_WIDGET_CARD_CLASS} relative z-20`}>
        <CardHeader className="space-y-1 pb-3">
          <CardTitle>Quick Book</CardTitle>
          <CardDescription>
            Search for a client to prefill booking, or book unregistered without prefilled details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminQuickBookWidgetClient />
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}

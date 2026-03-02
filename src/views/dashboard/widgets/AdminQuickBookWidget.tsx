import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminQuickBookWidgetClient } from './AdminQuickBookWidget.client'

export default function AdminQuickBookWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card>
        <CardHeader className="space-y-1 pb-3">
          <CardTitle>Quick Book</CardTitle>
          <CardDescription>
            Search for a client to open a prefilled Cal.com booking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminQuickBookWidgetClient />
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}

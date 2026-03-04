import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminQuickBookWidgetClient } from './AdminQuickBookWidget.client'

export default function AdminQuickBookWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin" className="relative z-20">
        <CardHeader>
          <CardTitle>Quick Book</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <AdminQuickBookWidgetClient />
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}

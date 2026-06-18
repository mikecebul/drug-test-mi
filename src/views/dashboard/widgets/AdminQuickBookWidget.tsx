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
      <Card variant="admin" className="relative z-20">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Quick Book</CardTitle>
          <CardDescription>Book an existing client or start a clean appointment.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminQuickBookWidgetClient />
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}

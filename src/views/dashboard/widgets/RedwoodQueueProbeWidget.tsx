import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RedwoodQueueProbeWidgetClient } from './RedwoodQueueProbeWidget.client'

export default function RedwoodQueueProbeWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin">
        <CardHeader className="pb-4">
          <CardTitle>Redwood Queue Probe</CardTitle>
          <CardDescription>Verify that the website can enqueue work and the Redwood worker can process it.</CardDescription>
        </CardHeader>
        <CardContent>
          <RedwoodQueueProbeWidgetClient />
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}

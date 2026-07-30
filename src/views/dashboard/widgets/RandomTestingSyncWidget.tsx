import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getRandomTestingSyncRuntimeState } from '@/lib/random-testing/runtime'
import { RandomTestingSyncWidgetClient } from './RandomTestingSyncWidget.client'

export default function RandomTestingSyncWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin">
        <CardHeader className="pb-4">
          <CardTitle>Random Testing Sync</CardTitle>
          <CardDescription>
            Verify ToxAccess, Cal.com, and Google Calendar, preview today, or queue the same jobs used by production
            cron.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RandomTestingSyncWidgetClient
            canQueue={req.user.role === 'superAdmin'}
            runtime={getRandomTestingSyncRuntimeState()}
          />
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}

// TODO: Implement appointments page with real data from Payload CMS
// Currently contains mock data and needs to be connected to actual appointment system

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AppointmentsPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground">Manage your upcoming appointments</p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The appointments feature is currently under development. You&apos;ll be able to view
              and manage your appointments here once it&apos;s complete.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

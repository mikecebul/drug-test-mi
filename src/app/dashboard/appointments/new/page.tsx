import { redirect } from 'next/navigation'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CalEmbed } from '@/components/cal-embed'

export const dynamic = 'force-dynamic'

export default async function NewAppointmentPage() {
  // Get authenticated client
  const client = await getAuthenticatedClient()
  if (!client) {
    redirect('/login')
  }

  // Get technician info if needed (or use default)
  const calLink = `mike-midrugtest`

  // Prepare client data for prefill
  const clientData = {
    name: client.name || '',
    email: client.email || '',
    phone: client.phone || '',
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      {/* Back Button */}
      <div>
        <Button variant="ghost" asChild>
          <Link href="/dashboard/appointments" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Appointments
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Schedule Appointment</h1>
        <p className="text-muted-foreground">
          Select a date and time for your drug test. Choose recurring option during booking if
          needed.
        </p>
      </div>

      {/* Booking Card */}
      <CalEmbed calLink={calLink} userData={clientData} />
    </div>
  )
}

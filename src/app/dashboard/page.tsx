import { Suspense } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DashboardClient } from './DashboardClient'
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query'

async function getDashboardData() {
  const headersList = await headers()
  const payload = await getPayload({ config })

  // Get authenticated user
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    redirect('/sign-in?redirect=/dashboard')
  }

  if (user.collection !== 'clients') {
    redirect('/admin')
  }

  // Get full client with populated relationships (like headshot)
  const client = await payload.findByID({
    collection: 'clients',
    id: user.id,
    depth: 2,
  })

  // Fetch related data in parallel
  const [drugScreenResults, bookings] = await Promise.all([
    payload.find({
      collection: 'private-media',
      where: {
        and: [
          { relatedClient: { equals: client.id } },
          { documentType: { equals: 'drug-screen' } },
        ],
      },
      sort: '-createdAt',
      limit: 10,
    }).catch(() => ({ docs: [], totalDocs: 0 })),

    payload.find({
      collection: 'bookings',
      where: {
        attendeeEmail: { equals: client.email },
      },
      sort: '-createdAt',
      limit: 10,
    }).catch(() => ({ docs: [] })),
  ])

  // Calculate stats
  const totalTests = drugScreenResults.totalDocs || 0
  const activeMedications = client.medications?.filter((med: any) => med.status === 'active').length || 0

  // Get most recent test result
  const recentTest = drugScreenResults.docs?.[0]
    ? {
        date: drugScreenResults.docs[0].createdAt,
        result: 'Negative',
        status: 'Verified',
      }
    : undefined

  return {
    user: {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
      clientType: client.clientType || 'self',
      isActive: client.isActive || false,
      headshot: client.headshot,
    },
    stats: {
      totalTests,
      compliantTests: totalTests,
      complianceRate: totalTests > 0 ? 100 : 0,
      activeMedications,
    },
    nextAppointment: client.recurringAppointments?.isRecurring && client.recurringAppointments.nextAppointmentDate
      ? {
          date: client.recurringAppointments.nextAppointmentDate,
          type: `${client.recurringAppointments.frequency || 'Weekly'} Drug Test`,
        }
      : undefined,
    recentTest,
    recurringSubscription: client.recurringAppointments?.isRecurring && client.recurringAppointments.frequency
      ? {
          isActive: client.recurringAppointments.subscriptionStatus === 'active',
          frequency: client.recurringAppointments.frequency,
          nextBilling: '2025-09-30',
          status: client.recurringAppointments.subscriptionStatus || 'inactive',
        }
      : undefined,
    medications: client.medications || [],
    drugScreenResults: drugScreenResults.docs || [],
    bookings: bookings.docs || [],
  }
}

export default async function DashboardPage() {
  const queryClient = new QueryClient()

  try {
    // Prefetch the dashboard data on the server
    const dashboardData = await getDashboardData()

    // Store it in TanStack Query cache
    queryClient.setQueryData(['clientDashboard'], dashboardData)

    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<div>Loading...</div>}>
          <DashboardClient initialData={dashboardData} />
        </Suspense>
      </HydrationBoundary>
    )
  } catch (error) {
    // Handle access denied or other errors
    redirect('/sign-in?redirect=/dashboard')
  }
}
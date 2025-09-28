import { Suspense } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DashboardClient } from './DashboardClient'
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query'
import { DrugTest } from '@/payload-types'
import { getAuthenticatedClient } from '@/utilities/getAuthenticatedClient'

// Helper functions to format test data
function formatTestResult(
  result: string | null | undefined,
  isDilute?: boolean | null,
  requiresConfirmation?: boolean | null,
  confirmationStatus?: string | null
): string {
  if (!result) return 'Pending'

  let formattedResult: string

  // If confirmation is required, show confirmation status instead of initial result
  if (requiresConfirmation && confirmationStatus) {
    switch (confirmationStatus) {
      case 'pending-confirmation': formattedResult = 'Pending Confirmation'; break
      case 'confirmed-positive': formattedResult = 'Confirmed Positive'; break
      case 'confirmed-negative': formattedResult = 'Confirmed Negative'; break
      case 'confirmation-inconclusive': formattedResult = 'Confirmation Inconclusive'; break
      default: formattedResult = 'Pending Confirmation'
    }
  } else if (requiresConfirmation && !confirmationStatus) {
    formattedResult = 'Pending Confirmation'
  } else {
    // Standard initial result
    switch (result) {
      case 'negative': formattedResult = 'Negative'; break
      case 'expected-positive': formattedResult = 'Expected Positive'; break
      case 'unexpected-positive': formattedResult = 'Unexpected Positive'; break
      case 'pending': formattedResult = 'Pending'; break
      case 'inconclusive': formattedResult = 'Inconclusive'; break
      default: formattedResult = 'Unknown'
    }
  }

  // Add dilute indicator if present
  if (isDilute) {
    formattedResult += ' (Dilute)'
  }

  return formattedResult
}

function formatTestStatus(status: string | null | undefined): string {
  if (!status) return 'Pending'

  switch (status) {
    case 'verified': return 'Verified'
    case 'under-review': return 'Under Review'
    case 'pending-lab': return 'Pending Lab Results'
    case 'requires-followup': return 'Requires Follow-up'
    default: return 'Unknown'
  }
}

async function getDashboardData() {
  const payload = await getPayload({ config })

  // Get authenticated client (authentication handled by getAuthenticatedClient)
  const client = await getAuthenticatedClient()

  // Fetch related data in parallel
  const [drugScreenResults, bookings] = await Promise.all([
    payload.find({
      collection: 'drug-tests',
      where: {
        relatedClient: { equals: client.id },
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

  // Calculate stats from real data
  const totalTests = drugScreenResults.totalDocs || 0
  const activeMedications = client.medications?.filter((med: any) => med.status === 'active').length || 0

  // Calculate compliance based on actual test results
  const compliantTests = drugScreenResults.docs?.filter((test: DrugTest) =>
    test.initialScreenResult === 'negative' || test.initialScreenResult === 'expected-positive'
  ).length || 0

  const complianceRate = totalTests > 0 ? Math.round((compliantTests / totalTests) * 100) : 0

  // Get most recent test result with real data
  const recentTest = drugScreenResults.docs?.[0]
    ? {
        date: (drugScreenResults.docs[0] as DrugTest).collectionDate || drugScreenResults.docs[0].createdAt,
        result: formatTestResult(
          (drugScreenResults.docs[0] as DrugTest).initialScreenResult,
          (drugScreenResults.docs[0] as DrugTest).isDilute,
          (drugScreenResults.docs[0] as DrugTest).confirmationDecision === 'request-confirmation',
          (drugScreenResults.docs[0] as DrugTest).confirmationStatus
        ),
        status: formatTestStatus((drugScreenResults.docs[0] as DrugTest).isComplete ? 'complete' : 'pending'),
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
      compliantTests,
      complianceRate,
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

  // Prefetch the dashboard data on the server
  // Authentication is already handled by the layout
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
}
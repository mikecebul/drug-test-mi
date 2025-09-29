import { useQuery } from '@tanstack/react-query'
import { DrugTest, Client } from '@/payload-types'

export type ClientDashboardData = {
  user: {
    id: string
    name: string
    email: string
    clientType: string
    isActive: boolean
    headshot?: any
  }
  stats: {
    totalTests: number
    compliantTests: number
    complianceRate: number
    activeMedications: number
    pendingTests: number
  }
  nextAppointment?: {
    date: string
    type: string
  }
  recentTest?: {
    date: string
    result: string
    status: string
  }
  recurringSubscription?: {
    isActive: boolean
    frequency: string
    nextBilling: string
    status: string
  }
  medications: any[]
  drugScreenResults: any[]
  bookings: any[]
}

// Helper functions to format test data using Payload types
function formatTestResult(
  result: DrugTest['initialScreenResult'],
  isDilute?: DrugTest['isDilute'],
  requiresConfirmation?: boolean,
  confirmationStatus?: DrugTest['confirmationStatus']
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

function formatTestStatus(status: string): string {
  if (!status) return 'Pending'

  switch (status) {
    case 'verified': return 'Verified'
    case 'under-review': return 'Under Review'
    case 'pending-lab': return 'Pending Lab Results'
    case 'requires-followup': return 'Requires Follow-up'
    default: return 'Unknown'
  }
}

// Real refetch function that gets actual data using Payload types
export async function refetchClientDashboard(): Promise<ClientDashboardData> {
  // Fetch user data
  const userResponse = await fetch('/api/clients/me', {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!userResponse.ok) {
    throw new Error('Failed to refetch user data')
  }

  const userData = await userResponse.json()
  if (!userData.user) {
    throw new Error('User not authenticated')
  }

  const client = userData.user as Client

  // Fetch drug test results
  const testResponse = await fetch('/api/drug-tests?depth=1', {
    credentials: 'include',
  })

  if (!testResponse.ok) {
    throw new Error('Failed to fetch test results')
  }

  const testResult = await testResponse.json()
  const drugScreenResults = (testResult.docs as DrugTest[]) || []

  // Calculate stats from real data
  const totalTests = drugScreenResults.length
  const activeMedications = client.medications?.filter((med: any) => med.status === 'active').length || 0

  // Only include tests that have completed at least initial screening for compliance calculation
  const testsWithInitialScreening = drugScreenResults.filter(test => test.initialScreenResult)
  const pendingTests = drugScreenResults.filter(test => !test.initialScreenResult).length
  const compliantTests = testsWithInitialScreening.filter(test =>
    test.initialScreenResult === 'negative' || test.initialScreenResult === 'expected-positive'
  ).length

  // Calculate compliance rate only from tests that have been screened
  const complianceRate = testsWithInitialScreening.length > 0 ? Math.round((compliantTests / testsWithInitialScreening.length) * 100) : 0

  // Get most recent test result with real data
  const recentTest = drugScreenResults[0]
    ? {
        date: drugScreenResults[0].collectionDate || drugScreenResults[0].createdAt,
        result: formatTestResult(
          drugScreenResults[0].initialScreenResult,
          drugScreenResults[0].isDilute,
          drugScreenResults[0].confirmationDecision === 'request-confirmation',
          drugScreenResults[0].confirmationStatus
        ),
        status: formatTestStatus(drugScreenResults[0].isComplete ? 'complete' : 'pending'),
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
      pendingTests,
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
    drugScreenResults: drugScreenResults,
    bookings: [], // Could fetch bookings separately if needed
  }
}

export function useClientDashboard() {
  return useQuery({
    queryKey: ['clientDashboard'],
    queryFn: refetchClientDashboard,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    // This data should be prefetched by the server component
    // so this will rarely actually fetch on the client
  })
}

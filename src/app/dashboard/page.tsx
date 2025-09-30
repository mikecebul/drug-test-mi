import { DashboardData, DashboardView } from './DashboardView'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Client, DrugTest } from '@/payload-types'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'

// Force dynamic rendering for fresh dashboard data on every request
export const dynamic = 'force-dynamic'

// Helper functions to format test data
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

export default async function DashboardPage() {
  const payload = await getPayload({ config })
  const client = await getAuthenticatedClient()

  // Fetch drug tests for this client
  const drugTestsResult = await payload.find({
    collection: 'drug-tests',
    where: {
      relatedClient: {
        equals: client.id,
      },
    },
    sort: '-collectionDate',
    limit: 100,
    depth: 1,
  })

  const drugScreenResults = drugTestsResult.docs

  // Calculate stats
  const totalTests = drugScreenResults.length
  const activeMedications = client.medications?.filter((med) => med.status === 'active').length || 0
  const testsWithInitialScreening = drugScreenResults.filter(test => test.initialScreenResult)
  const pendingTests = drugScreenResults.filter(test => !test.initialScreenResult).length
  const compliantTests = testsWithInitialScreening.filter(test =>
    test.initialScreenResult === 'negative' || test.initialScreenResult === 'expected-positive'
  ).length
  const complianceRate = testsWithInitialScreening.length > 0
    ? Math.round((compliantTests / testsWithInitialScreening.length) * 100)
    : 0

  // Get most recent test
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

  // Build dashboard data
  const dashboardData: DashboardData = {
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
  }

  return <DashboardView data={dashboardData} />
}
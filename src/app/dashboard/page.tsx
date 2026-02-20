import { DashboardData, DashboardView } from './DashboardView'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { DrugTest } from '@/payload-types'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'

// Force dynamic rendering for fresh dashboard data on every request
export const dynamic = 'force-dynamic'

// Helper functions to format test data
function formatTestResult(
  result: DrugTest['initialScreenResult'],
  isDilute?: DrugTest['isDilute'],
  requiresConfirmation?: boolean,
  confirmationResults?: DrugTest['confirmationResults'],
  confirmationSubstances?: DrugTest['confirmationSubstances'],
  isInconclusive?: DrugTest['isInconclusive'],
): string {
  // If test is marked as inconclusive (sample leaked, damaged, etc.)
  if (isInconclusive) return 'Inconclusive'

  if (!result) return 'Pending'

  let formattedResult: string

  // If confirmation is required, check confirmation results
  if (requiresConfirmation) {
    const confirmationSubstancesArray = confirmationSubstances || []
    const hasAllResults =
      Array.isArray(confirmationResults) &&
      confirmationResults.length === confirmationSubstancesArray.length &&
      confirmationResults.every((r: any) => r.result)

    if (!hasAllResults) {
      formattedResult = 'Pending Confirmation'
    } else {
      // Determine overall result from individual substance results
      const allPositive = confirmationResults.every((r: any) => r.result === 'confirmed-positive')
      const allNegative = confirmationResults.every((r: any) => r.result === 'confirmed-negative')
      const anyInconclusive = confirmationResults.some((r: any) => r.result === 'inconclusive')

      if (allNegative) {
        formattedResult = 'Confirmed Negative'
      } else if (allPositive) {
        formattedResult = 'Confirmed Positive'
      } else if (anyInconclusive) {
        formattedResult = 'Confirmation Inconclusive'
      } else {
        formattedResult = 'Confirmed Mixed Results'
      }
    }
  } else {
    // Standard initial result
    switch (result) {
      case 'negative':
        formattedResult = 'Negative'
        break
      case 'expected-positive':
        formattedResult = 'Expected Positive'
        break
      case 'unexpected-positive':
        formattedResult = 'Unexpected Positive'
        break
      case 'unexpected-negative-critical':
        formattedResult = 'Unexpected Negative (Critical)'
        break
      case 'unexpected-negative-warning':
        formattedResult = 'Unexpected Negative (Warning)'
        break
      case 'mixed-unexpected':
        formattedResult = 'Mixed Results'
        break
      default:
        formattedResult = 'Unknown'
    }
  }

  // Add dilute indicator if present
  if (isDilute) {
    formattedResult += ' (Dilute)'
  }

  return formattedResult
}

function formatTestStatus(isComplete: boolean, hasInitialResult: boolean): string {
  if (isComplete) {
    return 'Complete'
  }

  if (!hasInitialResult) {
    return 'Pending Lab Results'
  }

  return 'Awaiting Decision'
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

  // Fetch next upcoming booking for this client
  const now = new Date()
  const upcomingBookingsResult = await payload.find({
    collection: 'bookings',
    where: {
      relatedClient: {
        equals: client.id,
      },
      startTime: {
        greater_than: now.toISOString(),
      },
      status: {
        not_equals: 'cancelled',
      },
    },
    sort: 'startTime',
    limit: 1,
    depth: 0,
  })

  const nextBooking = upcomingBookingsResult.docs[0]

  // Calculate stats
  const totalTests = drugScreenResults.length
  const activeMedications = client.medications?.filter((med) => med.status === 'active').length || 0
  const completedTests = drugScreenResults.filter((test) => test.isComplete)
  const pendingTests = drugScreenResults.filter((test) => !test.initialScreenResult).length

  // Count compliant tests using finalStatus (if confirmation was done) or initialScreenResult
  const compliantTests = completedTests.filter((test) => {
    // Use finalStatus if available (means confirmation testing was completed)
    const resultToCheck = test.finalStatus || test.initialScreenResult

    // Compliant statuses: negative, expected-positive, confirmed-negative, unexpected-negative-warning
    return (
      resultToCheck === 'negative' ||
      resultToCheck === 'expected-positive' ||
      resultToCheck === 'confirmed-negative' ||
      resultToCheck === 'unexpected-negative-warning'
    )
  }).length

  const complianceRate =
    completedTests.length > 0
      ? Math.round((compliantTests / completedTests.length) * 100)
      : 0

  // Get most recent test
  const recentTest = drugScreenResults[0]
    ? {
        date: drugScreenResults[0].collectionDate || drugScreenResults[0].createdAt,
        result: formatTestResult(
          drugScreenResults[0].initialScreenResult,
          drugScreenResults[0].isDilute,
          drugScreenResults[0].confirmationDecision === 'request-confirmation',
          drugScreenResults[0].confirmationResults,
          drugScreenResults[0].confirmationSubstances,
          drugScreenResults[0].isInconclusive,
        ),
        status: formatTestStatus(
          drugScreenResults[0].isComplete || false,
          !!drugScreenResults[0].initialScreenResult,
        ),
      }
    : undefined

  // Build dashboard data
  const dashboardData: DashboardData = {
    user: {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
      referralType: client.referralType || 'self',
      isActive: client.isActive || false,
      headshot: client.headshot,
    },
    client,
    stats: {
      totalTests,
      compliantTests,
      complianceRate,
      activeMedications,
      pendingTests,
    },
    nextAppointment: nextBooking
      ? {
          date: nextBooking.startTime,
          type: nextBooking.title || 'Drug Test Appointment',
          calcomBookingId: nextBooking.calcomBookingId || undefined,
        }
      : undefined,
    recentTest,
  }

  return <DashboardView data={dashboardData} />
}

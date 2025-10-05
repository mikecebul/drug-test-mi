import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { ResultsView } from './ResultsView'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function TestResultsPage() {
  try {
    const client = await getAuthenticatedClient()
    const payload = await getPayload({ config })

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

    // Fetch company contact info for confirmation notice
    const companyInfo = await payload.findGlobal({
      slug: 'company-info',
    })

    return <ResultsView testResults={drugTestsResult.docs} contactPhone={companyInfo.contact?.phone || undefined} />
  } catch (error) {
    redirect('/sign-in?redirect=/dashboard/results')
  }
}
import { redirect } from 'next/navigation'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { MedicationsView } from './MedicationsView'
import type { Medication } from './types'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function MedicationsPage() {
  try {
    const client = await getAuthenticatedClient()

    const medications = (client.medications || []) as Medication[]

    return <MedicationsView medications={medications} />
  } catch (error) {
    redirect('/sign-in?redirect=/dashboard/medications')
  }
}
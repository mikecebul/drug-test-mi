import { redirect } from 'next/navigation'

import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { ReferralView } from './ReferralView'

export const dynamic = 'force-dynamic'

export default async function ReferralPage() {
  let client

  try {
    client = await getAuthenticatedClient()
  } catch (_error) {
    redirect('/sign-in?redirect=/dashboard/referral')
  }

  return <ReferralView user={client} />
}

import { redirect } from 'next/navigation'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { ProfileView } from './ProfileView'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  try {
    const client = await getAuthenticatedClient()

    return <ProfileView user={client} />
  } catch (error) {
    redirect('/sign-in?redirect=/dashboard/profile')
  }
}
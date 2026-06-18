import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { ProfileView } from './ProfileView'
import type { Client, CompanyInfo } from '@/payload-types'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  let client: Client
  let companyContact: CompanyInfo['contact'] | undefined

  try {
    client = await getAuthenticatedClient()
    const payload = await getPayload({ config })
    const companyInfo = await payload.findGlobal({
      slug: 'company-info',
    })
    companyContact = companyInfo.contact
  } catch (_error) {
    redirect('/sign-in?redirect=/dashboard/profile')
  }

  return <ProfileView user={client} companyContact={companyContact} />
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Client } from '@/payload-types'

export async function getAuthenticatedClient(): Promise<Client> {
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

  // Get full client with populated relationships
  const client = await payload.findByID({
    collection: 'clients',
    id: user.id,
    depth: 2,
  })

  return client as Client
}
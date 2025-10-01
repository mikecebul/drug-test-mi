import { headers } from 'next/headers'
import { getPayload } from 'payload'
import payloadConfig from '@payload-config'
import { redirect } from 'next/navigation'
import type { Client } from '@/payload-types'

export const requireClientAuth = async (): Promise<Client> => {
  const headersList = await headers()
  const payload = await getPayload({ config: payloadConfig })

  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    redirect('/sign-in?redirect=/dashboard')
  }

  if (user.collection === 'admins') {
    redirect('/admin')
  }

  return user as Client
}

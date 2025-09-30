import { headers } from 'next/headers'
import { getPayload } from 'payload'
import payloadConfig from '@payload-config'
import { redirect } from 'next/navigation'

export const requireClientAuth = async () => {
  const headersList = await headers()
  const payload = await getPayload({ config: payloadConfig })

  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    redirect('/sign-in?redirect=/dashboard')
  }

  if (user.collection === 'admins') {
    redirect('/admin')
  }
}

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

/** Every callable wizard action must authenticate, including actions called by another action. */
export async function requireWizardAdmin() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (user?.collection !== 'admins') throw new Error('Admin access required.')
  return { payload, user }
}

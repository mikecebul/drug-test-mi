'use server'

import { cookies, headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { baseUrl } from '@/utilities/baseUrl'

export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const payload = await getPayload({ config })

    // Use PayloadCMS's built-in auth to verify the session
    const { user } = await payload.auth({ headers: await headers() })

    // Only return email if user is authenticated but unverified
    if (!user) {
      // Try the direct API approach for unverified users
      const token = cookieStore.get('payload-token')?.value
      if (token) {
        const response = await fetch(`${baseUrl}/api/clients/me`, {
          headers: { 'Authorization': `JWT ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          if (data.user === null) { // Unverified user case
            const tokenPayload = JSON.parse(atob(token.split('.')[1]))
            return tokenPayload.email || null
          }
        }
      }
    }

    return null
  } catch (error) {
    return null
  }
}
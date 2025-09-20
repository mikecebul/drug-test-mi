'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    return result.docs.length > 0
  } catch (error) {
    console.error('Error checking email existence:', error)
    // Return false on error to avoid blocking registration
    return false
  }
}
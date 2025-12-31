import { sdk } from '@/lib/payload-sdk'

export interface SimpleClient {
  id: string
  firstName: string
  middleInitial?: string
  lastName: string
  fullName?: string
  initials: string
  email: string
  dob?: string
  headshot?: string
  matchType?: 'exact' | 'fuzzy'
  score?: number
}

export async function getClients(): Promise<SimpleClient[]> {
  const { docs: clientsResult } = await sdk.find({
    collection: 'clients',
    limit: 1000,
    sort: 'lastName',
    depth: 2, // Populate headshot relation
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleInitial: true,
      email: true,
      dob: true,
      headshot: true,
    },
  })
  const clients = clientsResult.map((client): SimpleClient => {
    // Prefer thumbnail for performance, fallback to full image
    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.thumbnailURL || client.headshot.url || undefined
        : undefined

    return {
      id: client.id,
      firstName: client.firstName,
      middleInitial: client.middleInitial ?? undefined,
      lastName: client.lastName,
      fullName: client.middleInitial
        ? `${client.firstName} ${client.middleInitial} ${client.lastName}`
        : `${client.firstName} ${client.lastName}`,
      initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`,
      email: client.email,
      dob: client.dob ?? undefined,
      headshot,
    }
  })
  return clients
}

export async function getClientById(
  id: string
): Promise<SimpleClient | null> {
  try {
    const client = await sdk.findByID({
      collection: 'clients',
      id,
      depth: 2,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleInitial: true,
        email: true,
        dob: true,
        headshot: true,
      },
    })

    if (!client) return null

    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.thumbnailURL || client.headshot.url || undefined
        : undefined

    return {
      id: client.id,
      firstName: client.firstName,
      middleInitial: client.middleInitial ?? undefined,
      lastName: client.lastName,
      fullName: client.middleInitial
        ? `${client.firstName} ${client.middleInitial} ${client.lastName}`
        : `${client.firstName} ${client.lastName}`,
      initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`,
      email: client.email,
      dob: client.dob ?? undefined,
      headshot,
    }
  } catch (err) {
    // Payload throws if not found
    return null
  }
}

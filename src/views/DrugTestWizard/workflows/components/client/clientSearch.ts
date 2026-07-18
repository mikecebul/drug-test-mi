import type { ClientSearchInput, ClientSearchResponse } from '@/collections/Clients/search/types'

export const CLIENT_SEARCH_MIN_CHARS = 2
export const CLIENT_SEARCH_DEBOUNCE_MS = 250

export async function searchClients(input: ClientSearchInput, signal?: AbortSignal): Promise<ClientSearchResponse> {
  const params = new URLSearchParams()

  if (input.query) params.set('q', input.query)
  if (input.name) params.set('name', input.name)
  if (input.email) params.set('email', input.email)
  if (input.phone) params.set('phone', input.phone)
  if (input.dob) params.set('dob', input.dob)
  if (input.recent) params.set('recent', 'true')
  if (input.limit) params.set('limit', String(input.limit))

  const response = await fetch(`/api/clients/admin-search?${params.toString()}`, {
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || 'Unable to search clients.')
  }

  return (await response.json()) as ClientSearchResponse
}

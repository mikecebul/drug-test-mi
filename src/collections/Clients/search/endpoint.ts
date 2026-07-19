import type { Endpoint } from 'payload'
import { searchClientsForAdmin } from './service'

function optionalParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim()
  return value || undefined
}

export const adminClientSearchEndpoint: Endpoint = {
  path: '/admin-search',
  method: 'get',
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Authentication required.' }, { status: 401 })
    }

    if (req.user.collection !== 'admins') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const url = new URL(req.url || 'http://localhost/api/clients/admin-search')
    const limitValue = Number(url.searchParams.get('limit'))

    const result = await searchClientsForAdmin({
      payload: req.payload,
      req,
      input: {
        query: optionalParam(url, 'q'),
        name: optionalParam(url, 'name'),
        email: optionalParam(url, 'email'),
        phone: optionalParam(url, 'phone'),
        dob: optionalParam(url, 'dob'),
        recent: url.searchParams.get('recent') === 'true',
        limit: Number.isFinite(limitValue) ? limitValue : undefined,
      },
    })

    return Response.json(result, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  },
}

import type { Access, CollectionConfig } from 'payload'
import { describe, expect, test } from 'vitest'

import { restrictMcpApiKeyCollection } from './restrictApiKeyCollection'

const generatedCollection: CollectionConfig = {
  slug: 'payload-mcp-api-keys',
  fields: [],
  access: {
    read: () => true,
  },
}

function invokeAccess(access: Access | undefined, collection: 'admins' | 'clients' | 'payload-mcp-api-keys' | null) {
  if (!access) throw new Error('Expected access control to be configured.')

  return access({
    req: {
      user: collection
        ? {
            id: `${collection}-1`,
            collection,
          }
        : null,
    },
  } as never)
}

describe('restrictMcpApiKeyCollection', () => {
  const securedCollection = restrictMcpApiKeyCollection(generatedCollection)
  const securedOperations = ['admin', 'create', 'delete', 'read', 'readVersions', 'unlock', 'update'] as const

  test.each(securedOperations)('allows admins to %s MCP API keys', (operation) => {
    expect(invokeAccess(securedCollection.access?.[operation], 'admins')).toBe(true)
  })

  test.each(securedOperations)('denies clients and MCP key identities from %s access', (operation) => {
    expect(invokeAccess(securedCollection.access?.[operation], 'clients')).toBe(false)
    expect(invokeAccess(securedCollection.access?.[operation], 'payload-mcp-api-keys')).toBe(false)
    expect(invokeAccess(securedCollection.access?.[operation], null)).toBe(false)
  })
})

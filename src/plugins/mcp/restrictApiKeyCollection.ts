import { admins } from '@/access/admins'
import type { CollectionConfig } from 'payload'

/** Keep MCP credentials and capability grants accessible only to Payload admins. */
export function restrictMcpApiKeyCollection(collection: CollectionConfig): CollectionConfig {
  return {
    ...collection,
    access: {
      ...collection.access,
      admin: ({ req: { user } }) => user?.collection === 'admins',
      create: admins,
      delete: admins,
      read: admins,
      readVersions: admins,
      unlock: admins,
      update: admins,
    },
  }
}

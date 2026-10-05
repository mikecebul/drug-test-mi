import { admins } from '@/access/admins'
import { isSuperAdminUser } from '@/plugins/staffNavigation'
import type { CollectionConfig } from 'payload'

/** Keep MCP credentials and capability grants accessible only to Payload admins. */
export function restrictMcpApiKeyCollection(collection: CollectionConfig): CollectionConfig {
  return {
    ...collection,
    admin: {
      ...collection.admin,
      hidden: ({ user }) => !isSuperAdminUser(user),
    },
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

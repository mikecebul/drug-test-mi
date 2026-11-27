import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'
import { superAdminFieldAccess } from '@/access/superAdminFieldAccess'
import type { Access, CollectionConfig } from 'payload'
import { clientPaymentToolNames } from './clientPaymentTools'

const manageMcpKey: Access = (args) => {
  if (!admins(args)) return false
  if (superAdmin(args)) return true
  // A key with billing permissions cannot be read or rotated by a regular admin.
  return {
    and: clientPaymentToolNames.map((name) => ({ [`payload-mcp-tool.${name}`]: { not_equals: true } })),
  }
}

/** Keep MCP credentials and capability grants accessible only to Payload admins. */
export function restrictMcpApiKeyCollection(collection: CollectionConfig): CollectionConfig {
  return {
    ...collection,
    fields: collection.fields.map((field) => {
      if (field.type !== 'collapsible') return field
      return {
        ...field,
        fields: field.fields.map((group) => {
          if (group.type !== 'group' || !('name' in group) || group.name !== 'payload-mcp-tool') return group
          return {
            ...group,
            fields: group.fields.map((tool) => {
              if (tool.type !== 'checkbox' || !clientPaymentToolNames.some((name) => name === tool.name)) return tool
              return {
                ...tool,
                defaultValue: false,
                access: { create: superAdminFieldAccess.update, update: superAdminFieldAccess.update },
              }
            }),
          }
        }),
      }
    }),
    access: {
      ...collection.access,
      admin: ({ req: { user } }) => user?.collection === 'admins',
      create: admins,
      delete: manageMcpKey,
      read: manageMcpKey,
      readVersions: manageMcpKey,
      unlock: manageMcpKey,
      update: manageMcpKey,
    },
  }
}

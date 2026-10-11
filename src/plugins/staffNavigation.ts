import { definePlugin, type Config, type Plugin } from 'payload'

export function isSuperAdminUser(user: { collection?: string; role?: string | null } | null | undefined) {
  return user?.collection === 'admins' && user.role === 'superAdmin'
}

const staffCollections = new Set(['clients', 'courts', 'employers'])
// group:false removes native navigation entries without disabling staff document routes.
// The existing Operations links expose these collections to super admins.
const staffDocumentRoutes = new Set(['drug-tests', 'private-media', 'payments', 'bookings'])

const applyStaffNavigation = (config: Config): Config => ({
  ...config,
  collections: config.collections?.map((collection) => {
    if (staffCollections.has(collection.slug))
      return {
        ...collection,
        admin: { ...collection.admin, group: collection.slug === 'clients' ? 'Collections' : 'Referrals' },
      }
    if (staffDocumentRoutes.has(collection.slug)) return { ...collection, admin: { ...collection.admin, group: false } }
    const hidden = collection.admin?.hidden
    return {
      ...collection,
      admin: {
        ...collection.admin,
        hidden: ({ user }) =>
          !isSuperAdminUser(user) || (typeof hidden === 'function' ? hidden({ user }) : Boolean(hidden)),
      },
    }
  }),
  globals: config.globals?.map((global) => ({
    ...global,
    admin: { ...global.admin, hidden: ({ user }) => !isSuperAdminUser(user) },
  })),
  jobs: {
    ...config.jobs,
    jobsCollectionOverrides: (args) => {
      const collection = config.jobs?.jobsCollectionOverrides?.(args) || args.defaultJobsCollection
      return { ...collection, admin: { ...collection.admin, hidden: ({ user }) => !isSuperAdminUser(user) } }
    },
  },
})

// Run after Payload's built-in plugins have added their generated collections.
export const staffNavigation: Plugin = definePlugin({
  slug: 'staff-navigation',
  order: 100,
  plugin: ({ config }) => applyStaffNavigation(config),
})()

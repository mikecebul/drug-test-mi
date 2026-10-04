import type { Config, Plugin } from 'payload'

export function isSuperAdminUser(user: { collection?: string; role?: string | null } | null | undefined) {
  return user?.collection === 'admins' && user.role === 'superAdmin'
}

const staffCollections = new Set(['clients', 'courts', 'employers'])
// These native routes remain available for report, headshot, tracker and booking links.
const staffDocumentRoutes = new Set(['drug-tests', 'private-media', 'payments', 'bookings'])

export const staffNavigation: Plugin = (config: Config) => ({
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

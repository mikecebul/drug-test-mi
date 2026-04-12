import type { CollectionAfterChangeHook } from 'payload'

import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'

export const ensureRedwoodUniqueId: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (req.context?.skipEnsureRedwoodUniqueId) {
    return doc
  }

  const currentValue = typeof doc?.redwoodUniqueId === 'string' ? doc.redwoodUniqueId.trim() : ''
  if (currentValue) {
    return doc
  }

  const previousValue = typeof previousDoc?.redwoodUniqueId === 'string' ? previousDoc.redwoodUniqueId.trim() : ''
  if (previousValue) {
    return doc
  }

  await req.payload.update({
    collection: 'clients',
    id: String(doc.id),
    data: {
      redwoodUniqueId: buildRedwoodUniqueId(String(doc.id)),
    },
    context: {
      ...req.context,
      skipEnsureRedwoodUniqueId: true,
    },
    overrideAccess: true,
  })

  return doc
}

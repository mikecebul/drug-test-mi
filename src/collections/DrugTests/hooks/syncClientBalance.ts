import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

type ClientId = string | number

function getRelationshipId(value: unknown): ClientId | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

async function calculateMoneyOwed(req: PayloadRequest, clientId: ClientId) {
  const tests = await req.payload.find({
    collection: 'drug-tests',
    where: {
      and: [
        {
          relatedClient: {
            equals: clientId,
          },
        },
        {
          'payment.balanceDue': {
            greater_than: 0,
          },
        },
      ],
    },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })

  return tests.docs.reduce((total, test) => {
    const balance = typeof test.payment?.balanceDue === 'number' ? test.payment.balanceDue : 0
    return total + balance
  }, 0)
}

async function syncClientMoneyOwed(req: PayloadRequest, clientId: ClientId | null) {
  if (!clientId) return

  const moneyOwed = await calculateMoneyOwed(req, clientId)

  await req.payload.update({
    collection: 'clients',
    id: clientId,
    data: {
      moneyOwed,
    },
    overrideAccess: true,
    context: {
      skipClientBalanceSync: true,
    },
  })
}

export const syncClientBalanceAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (req.context?.skipClientBalanceSync) return doc

  const currentClientId = getRelationshipId(doc.relatedClient)
  const previousClientId = getRelationshipId(previousDoc?.relatedClient)

  await syncClientMoneyOwed(req, currentClientId)

  if (previousClientId && previousClientId !== currentClientId) {
    await syncClientMoneyOwed(req, previousClientId)
  }

  return doc
}

export const syncClientBalanceAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (req.context?.skipClientBalanceSync) return doc

  await syncClientMoneyOwed(req, getRelationshipId(doc.relatedClient))

  return doc
}

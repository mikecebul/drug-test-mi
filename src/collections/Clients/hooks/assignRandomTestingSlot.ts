import type { CollectionBeforeChangeHook } from 'payload'

import { findEarliestRandomTestingSlot, getRandomTestingAssignedTimes } from '@/lib/random-testing/slots'

function idOf(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}

export const assignRandomTestingSlot: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (!data) return data

  const wasActive = Boolean(originalDoc?.randomTestingActive)
  const willBeActive = data.randomTestingActive === undefined ? wasActive : Boolean(data.randomTestingActive)

  if (!willBeActive) {
    if (wasActive || data.randomTestingActive === false) {
      data.randomTestingSlotIndex = null
      data.randomTestingWeekdayTime = null
      data.randomTestingWeekendTime = null
      data.randomTestingAssignedAt = null
    }
    return data
  }

  const existingIndex =
    typeof originalDoc?.randomTestingSlotIndex === 'number' ? originalDoc.randomTestingSlotIndex : null
  if (wasActive && existingIndex !== null) {
    const assignedTimes = getRandomTestingAssignedTimes(existingIndex)
    data.randomTestingSlotIndex = existingIndex
    data.randomTestingWeekdayTime = assignedTimes.weekday
    data.randomTestingWeekendTime = assignedTimes.weekend
    data.randomTestingAssignedAt = originalDoc.randomTestingAssignedAt || new Date().toISOString()
    return data
  }

  const currentId = operation === 'update' ? idOf(originalDoc?.id) : null
  const activeClients = await req.payload.find({
    collection: 'clients',
    where: {
      and: [{ randomTestingActive: { equals: true } }, ...(currentId ? [{ id: { not_equals: currentId } }] : [])],
    },
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
    req,
    select: {
      randomTestingSlotIndex: true,
    },
  })

  const slotIndex = findEarliestRandomTestingSlot(
    activeClients.docs
      .map((client) => client.randomTestingSlotIndex)
      .filter((value): value is number => typeof value === 'number'),
  )
  const assignedTimes = getRandomTestingAssignedTimes(slotIndex)

  data.randomTestingSlotIndex = slotIndex
  data.randomTestingWeekdayTime = assignedTimes.weekday
  data.randomTestingWeekendTime = assignedTimes.weekend
  data.randomTestingAssignedAt = new Date().toISOString()

  return data
}

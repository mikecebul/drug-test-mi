'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CourtOption, CourtRecord } from '../types/recipient-types'

function normalizeContacts(court: CourtRecord): Array<{ name?: string; email: string }> {
  const deduped = new Map<string, { name?: string; email: string }>()
  const push = (raw: { name?: string | null; email?: string | null }) => {
    const email = raw.email?.trim()
    if (!email) return
    const key = email.toLowerCase()
    const name = raw.name?.trim() || undefined
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, { name, email })
      return
    }
    if (!existing.name && name) {
      deduped.set(key, { name, email: existing.email })
    }
  }

  for (const contact of court.contacts || []) {
    push(contact)
  }

  push({ name: court.mainContactName, email: court.mainContactEmail })

  for (const recipient of court.recipientEmails || []) {
    push({ email: recipient?.email })
  }

  return Array.from(deduped.values())
}

function toCourtOption(court: CourtRecord): CourtOption | null {
  const contacts = normalizeContacts(court)
  if (!court.id || !court.name || contacts.length === 0) {
    return null
  }

  const preferredTestTypeLabel =
    typeof court.preferredTestType === 'object'
      ? court.preferredTestType?.label || court.preferredTestType?.value
      : undefined

  return {
    id: court.id,
    name: court.name,
    contacts,
    recipientEmails: contacts.map((contact) => contact.email),
    preferredTestTypeLabel: preferredTestTypeLabel || undefined,
  }
}

export function useCourtOptions(options?: { includeInactive?: boolean }) {
  const [courts, setCourts] = useState<CourtOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const includeInactive = options?.includeInactive === true

  useEffect(() => {
    let mounted = true

    const fetchCourts = async () => {
      try {
        const whereClause = includeInactive ? '' : '&where[isActive][equals]=true'
        const response = await fetch(`/api/courts?limit=200&sort=name&depth=1${whereClause}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch courts: ${response.status}`)
        }

        const json = (await response.json()) as { docs?: CourtRecord[] }
        const mapped = (json.docs || []).map(toCourtOption).filter((court): court is CourtOption => court !== null)

        if (mounted) {
          setCourts(mapped)
        }
      } catch (error) {
        console.error('Failed to load court options:', error)
        if (mounted) {
          setCourts([])
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void fetchCourts()

    return () => {
      mounted = false
    }
  }, [includeInactive])

  const courtsById = useMemo(() => {
    return new Map(courts.map((court) => [court.id, court]))
  }, [courts])

  return {
    courts,
    courtsById,
    isLoading,
  }
}

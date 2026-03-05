'use client'

import { useEffect, useMemo, useState } from 'react'
import type { EmployerOption, EmployerRecord } from '../types/recipient-types'

function normalizeContacts(employer: EmployerRecord): Array<{ name?: string; email: string }> {
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

  for (const contact of employer.contacts || []) {
    push(contact)
  }

  push({
    name: employer.mainContactName || employer.contactName,
    email: employer.mainContactEmail || employer.contactEmail,
  })

  for (const recipient of employer.recipientEmails || []) {
    push({ email: recipient?.email })
  }

  return Array.from(deduped.values())
}

function toEmployerOption(employer: EmployerRecord): EmployerOption | null {
  const contacts = normalizeContacts(employer)
  if (!employer.id || !employer.name || contacts.length === 0) {
    return null
  }

  const preferredTestTypeLabel =
    typeof employer.preferredTestType === 'object'
      ? employer.preferredTestType?.label || employer.preferredTestType?.value
      : undefined

  return {
    id: employer.id,
    name: employer.name,
    contacts,
    recipientEmails: contacts.map((contact) => contact.email),
    preferredTestTypeLabel: preferredTestTypeLabel || undefined,
  }
}

export function useEmployerOptions(options?: { includeInactive?: boolean }) {
  const [employers, setEmployers] = useState<EmployerOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const includeInactive = options?.includeInactive === true

  useEffect(() => {
    let mounted = true

    const fetchEmployers = async () => {
      try {
        const whereClause = includeInactive ? '' : '&where[isActive][equals]=true'
        const response = await fetch(`/api/employers?limit=200&sort=name&depth=1${whereClause}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch employers: ${response.status}`)
        }

        const json = (await response.json()) as { docs?: EmployerRecord[] }
        const mapped = (json.docs || [])
          .map(toEmployerOption)
          .filter((employer): employer is EmployerOption => employer !== null)

        if (mounted) {
          setEmployers(mapped)
        }
      } catch (error) {
        console.error('Failed to load employer options:', error)
        if (mounted) {
          setEmployers([])
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void fetchEmployers()

    return () => {
      mounted = false
    }
  }, [includeInactive])

  const employersById = useMemo(() => {
    return new Map(employers.map((employer) => [employer.id, employer]))
  }, [employers])

  return {
    employers,
    employersById,
    isLoading,
  }
}

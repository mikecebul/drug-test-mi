'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import { Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import ShadcnWrapper from '@/components/ShadcnWrapper'

type RecipientInfo = {
  name?: string
  email: string
}

type ResolvedReferral = {
  relationTo: 'courts' | 'employers'
  id: string
  name?: string
  contacts: RecipientInfo[]
}

function normalizeContacts(doc: any): RecipientInfo[] {
  const recipients = new Map<string, RecipientInfo>()

  const add = (raw: { name?: string | null; email?: string | null }) => {
    const email = raw.email?.trim()
    if (!email) return

    const key = email.toLowerCase()
    const name = raw.name?.trim() || undefined
    const existing = recipients.get(key)

    if (!existing) {
      recipients.set(key, { ...(name ? { name } : {}), email })
      return
    }

    if (!existing.name && name) {
      recipients.set(key, { name, email: existing.email })
    }
  }

  for (const contact of doc?.contacts || []) {
    add(contact || {})
  }

  add({
    name: doc?.mainContactName || doc?.contactName,
    email: doc?.mainContactEmail || doc?.contactEmail,
  })

  for (const row of doc?.recipientEmails || []) {
    if (typeof row === 'string') {
      add({ email: row })
    } else {
      add({ email: row?.email })
    }
  }

  return Array.from(recipients.values())
}

function resolveReferralValue(
  referralType: string | undefined,
  referralValue: unknown,
): ResolvedReferral | null {
  if (referralType !== 'court' && referralType !== 'employer') {
    return null
  }

  const expectedRelationTo: 'courts' | 'employers' = referralType === 'court' ? 'courts' : 'employers'

  let relationTo: 'courts' | 'employers' = expectedRelationTo
  let relationValue: unknown = referralValue

  if (
    referralValue &&
    typeof referralValue === 'object' &&
    'relationTo' in referralValue &&
    'value' in referralValue
  ) {
    const maybeRelationTo = (referralValue as { relationTo?: unknown }).relationTo
    relationTo = maybeRelationTo === 'courts' || maybeRelationTo === 'employers'
      ? maybeRelationTo
      : expectedRelationTo
    relationValue = (referralValue as { value?: unknown }).value
  }

  if (relationTo !== expectedRelationTo) {
    return null
  }

  if (typeof relationValue === 'string') {
    return {
      relationTo,
      id: relationValue,
      contacts: [],
    }
  }

  if (relationValue && typeof relationValue === 'object' && 'id' in relationValue) {
    const id = (relationValue as { id?: unknown }).id
    if (typeof id !== 'string') return null

    return {
      relationTo,
      id,
      name: typeof (relationValue as { name?: unknown }).name === 'string'
        ? (relationValue as { name?: string }).name
        : undefined,
      contacts: normalizeContacts(relationValue),
    }
  }

  return null
}

export const ReferralPresetRecipientsAlert: UIFieldClientComponent = () => {
  const formValues = useFormFields(([fields]) => ({
    referralType: fields.referralType?.value as string | undefined,
    referral: fields.referral?.value,
  }))

  const [isLoading, setIsLoading] = useState(false)
  const [presetName, setPresetName] = useState<string>('')
  const [recipients, setRecipients] = useState<RecipientInfo[]>([])

  const resolvedReferral = useMemo(() => {
    return resolveReferralValue(formValues.referralType, formValues.referral)
  }, [formValues.referralType, formValues.referral])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (!resolvedReferral) {
        setPresetName('')
        setRecipients([])
        setIsLoading(false)
        return
      }

      if (resolvedReferral.contacts.length > 0) {
        setPresetName(resolvedReferral.name || '')
        setRecipients(resolvedReferral.contacts)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/${resolvedReferral.relationTo}/${resolvedReferral.id}?depth=1`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Failed to load preset recipients: ${response.status}`)
        }

        const doc = await response.json()
        if (!isMounted) return

        setPresetName(typeof doc?.name === 'string' ? doc.name : '')
        setRecipients(normalizeContacts(doc))
      } catch (error) {
        if (!isMounted) return
        console.error('[ReferralPresetRecipientsAlert] Failed to load recipients:', error)
        setRecipients([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [resolvedReferral?.id, resolvedReferral?.relationTo, resolvedReferral?.name, resolvedReferral?.contacts])

  if (!resolvedReferral) {
    return null
  }

  const typeLabel = resolvedReferral.relationTo === 'courts' ? 'court' : 'employer'
  const headingName = presetName || resolvedReferral.name || `selected ${typeLabel}`

  return (
    <ShadcnWrapper className="pb-0">
      <Alert variant="info" className="mb-4 mt-2">
        <Info />
        <AlertTitle>
          Preset recipients for {headingName}
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>These contacts will receive referral emails and reports for this client.</p>
          {isLoading ? (
            <p>Loading preset recipients...</p>
          ) : recipients.length === 0 ? (
            <p>No preset recipients are currently configured.</p>
          ) : (
            <ul className="list-disc pl-5">
              {recipients.map((recipient) => (
                <li key={recipient.email.toLowerCase()}>
                  {recipient.name ? `${recipient.name} (${recipient.email})` : recipient.email}
                </li>
              ))}
            </ul>
          )}
        </AlertDescription>
      </Alert>
    </ShadcnWrapper>
  )
}

export default ReferralPresetRecipientsAlert

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'
import { useDocumentInfo } from '@payloadcms/ui/providers/DocumentInfo'

import {
  getChangedRedwoodClientUpdateFields,
  isEligibleForRedwoodClientUpdate,
  normalizePendingRedwoodClientUpdateFields,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
  resolveRedwoodClientUpdateSaveBehavior,
  resolveRedwoodPendingSyncMode,
} from '../redwoodSyncFields'

type WatchedField = {
  initialValue?: unknown
  value?: unknown
}

type SyncFormState = {
  firstName: WatchedField
  middleInitial: WatchedField
  lastName: WatchedField
  dob: WatchedField
  gender: WatchedField
  phone: WatchedField
}

function toFieldState(raw: unknown): WatchedField {
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  const field = raw as { initialValue?: unknown; value?: unknown }
  return {
    initialValue: field.initialValue,
    value: field.value,
  }
}

function resolveClientId(id: unknown): string | undefined {
  if (id != null) {
    return String(id)
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window.location.pathname.match(/\/admin\/collections\/clients\/([^/]+)/)?.[1]
}

async function fetchRedwoodClientState(clientId: string): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/clients/${clientId}?depth=0`, {
    cache: 'no-store',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to load client Redwood state: ${response.status}`)
  }

  return (await response.json()) as Record<string, unknown>
}

function readUpdatedAtTimestamp(doc: null | Record<string, unknown>): number {
  if (!doc || typeof doc.updatedAt !== 'string') {
    return -1
  }

  const timestamp = Date.parse(doc.updatedAt)
  return Number.isNaN(timestamp) ? -1 : timestamp
}

export function useRedwoodClientSyncState() {
  const { data, id } = useDocumentInfo()
  const serverDoc = useMemo(() => ((data && typeof data === 'object' ? data : {}) as Record<string, unknown>), [data])
  const [fetchedDoc, setFetchedDoc] = useState<null | Record<string, unknown>>(null)
  const clientId = resolveClientId(id)

  const formState = useFormFields(([fields]): SyncFormState => ({
    firstName: toFieldState(fields.firstName),
    middleInitial: toFieldState(fields.middleInitial),
    lastName: toFieldState(fields.lastName),
    dob: toFieldState(fields.dob),
    gender: toFieldState(fields.gender),
    phone: toFieldState(fields.phone),
  }))

  useEffect(() => {
    if (!clientId) {
      return
    }

    let isMounted = true

    const load = async () => {
      try {
        const doc = await fetchRedwoodClientState(clientId)
        if (isMounted) {
          setFetchedDoc(doc)
        }
      } catch (error) {
        if (isMounted) {
          console.error('[useRedwoodClientSyncState] Failed to load Redwood client state:', error)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [clientId])

  const savedDoc = useMemo(() => {
    if (!fetchedDoc) {
      return serverDoc
    }

    return readUpdatedAtTimestamp(serverDoc) >= readUpdatedAtTimestamp(fetchedDoc) ? serverDoc : fetchedDoc
  }, [fetchedDoc, serverDoc])

  const currentDoc = useMemo(
    () => ({
      firstName: formState.firstName.value,
      middleInitial: formState.middleInitial.value,
      lastName: formState.lastName.value,
      dob: formState.dob.value,
      gender: formState.gender.value,
      phone: formState.phone.value,
      redwoodDonorId: savedDoc.redwoodDonorId,
      redwoodSyncStatus: savedDoc.redwoodSyncStatus,
    }),
    [formState, savedDoc.redwoodDonorId, savedDoc.redwoodSyncStatus],
  )

  const initialDoc = useMemo(
    () => ({
      firstName: formState.firstName.initialValue,
      middleInitial: formState.middleInitial.initialValue,
      lastName: formState.lastName.initialValue,
      dob: formState.dob.initialValue,
      gender: formState.gender.initialValue,
      phone: formState.phone.initialValue,
      redwoodDonorId: savedDoc.redwoodDonorId,
      redwoodSyncStatus: savedDoc.redwoodSyncStatus,
    }),
    [formState, savedDoc.redwoodDonorId, savedDoc.redwoodSyncStatus],
  )

  const changedFields = useMemo(
    () => getChangedRedwoodClientUpdateFields(currentDoc, initialDoc),
    [currentDoc, initialDoc],
  )

  const pendingFields = useMemo(
    () => normalizePendingRedwoodClientUpdateFields(savedDoc[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]),
    [savedDoc],
  )

  const eligible = useMemo(() => isEligibleForRedwoodClientUpdate(currentDoc, savedDoc), [currentDoc, savedDoc])
  const redwoodClientUpdateStatus =
    typeof savedDoc.redwoodClientUpdateStatus === 'string' ? savedDoc.redwoodClientUpdateStatus : 'not-queued'
  const pendingSyncMode = useMemo(
    () =>
      resolveRedwoodPendingSyncMode({
        eligible,
        pendingFields,
        redwoodClientUpdateStatus,
      }),
    [eligible, pendingFields, redwoodClientUpdateStatus],
  )
  const saveBehavior = useMemo(
    () =>
      resolveRedwoodClientUpdateSaveBehavior({
        pendingFields,
        redwoodClientUpdateStatus,
      }),
    [pendingFields, redwoodClientUpdateStatus],
  )

  useEffect(() => {
    if (!clientId || (pendingFields.length === 0 && pendingSyncMode !== 'queued')) {
      return
    }

    let isMounted = true

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const doc = await fetchRedwoodClientState(clientId)
          if (isMounted) {
            setFetchedDoc(doc)
          }
        } catch (error) {
          if (isMounted) {
            console.error('[useRedwoodClientSyncState] Failed to poll Redwood client state:', error)
          }
        }
      })()
    }, 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [clientId, pendingFields.length, pendingSyncMode])

  const refreshState = async () => {
    if (!clientId) {
      return null
    }

    try {
      const doc = await fetchRedwoodClientState(clientId)
      setFetchedDoc(doc)
      return doc
    } catch (error) {
      console.error('[useRedwoodClientSyncState] Failed to refresh Redwood client state:', error)
      return null
    }
  }

  return {
    changedFields,
    eligible,
    pendingFields,
    pendingSyncMode,
    redwoodClientUpdateStatus,
    refreshState,
    saveBehavior,
  }
}

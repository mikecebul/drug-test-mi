'use client'

import { useAuth } from '@payloadcms/ui'
import type { TypedUser, UIFieldClientComponent } from 'payload'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

import ShadcnWrapper from '@/components/ShadcnWrapper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getRedwoodClientUpdateFieldLabel } from '../redwoodSyncFields'
import { useRedwoodClientSyncState } from './useRedwoodClientSyncState'

export const RedwoodClientSyncAlert: UIFieldClientComponent = () => {
  const { user } = useAuth<TypedUser>()
  const { changedFields, eligible, pendingFields, pendingSyncMode } = useRedwoodClientSyncState()

  if (user?.collection !== 'admins' || (!eligible && pendingFields.length === 0)) {
    return null
  }

  const changedFieldLabels = changedFields.map((field) => getRedwoodClientUpdateFieldLabel(field))
  const pendingFieldLabels = pendingFields.map((field) => getRedwoodClientUpdateFieldLabel(field))

  return (
    <ShadcnWrapper className="pb-0">
      <div className="space-y-4">
        {pendingFields.length > 0 ? (
          <Alert variant={pendingSyncMode === 'queued' ? 'info' : 'warning'}>
            <RefreshCcw />
            <AlertTitle>{pendingSyncMode === 'queued' ? 'Redwood sync queued' : 'Unsynced Redwood data'}</AlertTitle>
            <AlertDescription>
              <p>
                {pendingSyncMode === 'queued'
                  ? `A Redwood sync is already queued for ${pendingFieldLabels.join(', ')}. Additional saved Redwood edits will stay pending until that job finishes.`
                  : `Redwood still needs the latest values for ${pendingFieldLabels.join(', ')}. Use the sync control above to push the saved drift when you are ready, or clear the stale pending state from the popover if Redwood already matches.`}
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {eligible && changedFields.length > 0 ? (
          <Alert variant="info">
            <AlertTriangle />
            <AlertTitle>Saving will require a Redwood decision</AlertTitle>
            <AlertDescription>
              <p>
                The current edits change Redwood-backed fields: {changedFieldLabels.join(', ')}. Saving will open a
                Redwood sync review before the record is updated.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </ShadcnWrapper>
  )
}

export default RedwoodClientSyncAlert

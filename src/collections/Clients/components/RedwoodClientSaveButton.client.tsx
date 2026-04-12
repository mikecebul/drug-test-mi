'use client'

import { useState } from 'react'
import { useAuth, useForm } from '@payloadcms/ui'
import { useFormModified } from '@payloadcms/ui/forms/Form'
import { useHotkey } from '@payloadcms/ui/hooks/useHotkey'
import { useDocumentInfo } from '@payloadcms/ui/providers/DocumentInfo'
import { useEditDepth } from '@payloadcms/ui/providers/EditDepth'
import { useOperation } from '@payloadcms/ui/providers/Operation'
import { Loader2, Save as SaveIcon } from 'lucide-react'
import type { SaveButtonClientProps, TypedUser } from 'payload'

import ShadcnWrapper from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getRedwoodClientUpdateFieldLabel,
  REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD,
  REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD,
  type RedwoodClientUpdateField,
  type RedwoodClientUpdateSaveBehavior,
} from '../redwoodSyncFields'
import { useRedwoodClientSyncState } from './useRedwoodClientSyncState'

export default function RedwoodClientSaveButton({ label }: SaveButtonClientProps) {
  const [decisionFields, setDecisionFields] = useState<RedwoodClientUpdateField[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user } = useAuth<TypedUser>()
  const { submit } = useForm()
  const { uploadStatus } = useDocumentInfo()
  const modified = useFormModified()
  const operation = useOperation()
  const editDepth = useEditDepth()
  const { changedFields, eligible, pendingFields, pendingSyncMode, refreshState, saveBehavior } =
    useRedwoodClientSyncState()

  const canSkipSync = user?.collection === 'admins' && user.role === 'superAdmin'
  const disabled = isSubmitting || uploadStatus === 'uploading' || (operation === 'update' && !modified)
  const saveLabel = isSubmitting ? 'Saving...' : label || 'Save'

  useHotkey(
    {
      cmdCtrlKey: true,
      editDepth,
      keyCodes: ['s'],
    },
    (event) => {
      if (disabled) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void handleSaveClick()
    },
  )

  const submitWithDecision = async (mode?: 'sync' | 'skip') => {
    setIsSubmitting(true)

    try {
      setIsOpen(false)
      await submit({
        overrides: {
          [REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD]: mode === 'sync',
          [REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD]: mode === 'skip',
        },
      })
      await refreshState()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveClick = async () => {
    if (uploadStatus === 'uploading' || disabled) {
      return
    }

    if (user?.collection === 'admins' && eligible && changedFields.length > 0) {
      setDecisionFields(changedFields)
      setIsOpen(true)
      return
    }

    await submitWithDecision()
  }

  const changedFieldLabels = decisionFields.map((field) => getRedwoodClientUpdateFieldLabel(field))
  const pendingFieldLabels = pendingFields.map((field) => getRedwoodClientUpdateFieldLabel(field))
  const isSavePendingMode = saveBehavior === 'save-pending'
  const primaryActionLabel = getPrimaryActionLabel(saveBehavior, pendingSyncMode)
  const dialogDescription = isSavePendingMode
    ? pendingSyncMode === 'queued'
      ? `You changed Redwood-backed client fields: ${changedFieldLabels.join(', ')}. A Redwood client sync is already queued, so saving now will merge these edits into the pending Redwood changes instead of creating another job.`
      : `You changed Redwood-backed client fields: ${changedFieldLabels.join(', ')}. Redwood already has pending saved drift for ${pendingFieldLabels.join(', ')}, so saving now will merge these edits into the pending Redwood changes for the sync control above.`
    : `You changed Redwood-backed client fields: ${changedFieldLabels.join(', ')}.`

  return (
    <ShadcnWrapper className="pb-0">
      <Button
        className="rounded-md px-5 font-semibold tracking-[0.01em] shadow-sm"
        disabled={disabled}
        id="action-save"
        onClick={() => void handleSaveClick()}
        type="button"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="mr-2 h-4 w-4" />}
        {saveLabel}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => (!isSubmitting ? setIsOpen(open) : undefined)}>
        <DialogContent className="max-w-2xl p-0 sm:max-w-2xl" showCloseButton={!isSubmitting}>
          <ShadcnWrapper className="space-y-6 p-6">
            <DialogHeader className="space-y-2 pr-12 text-left">
              <DialogTitle>Review Redwood sync decision</DialogTitle>
              <DialogDescription className="text-sm leading-6">{dialogDescription}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm leading-7">
              {isSavePendingMode ? (
                <p>
                  Saving will keep the admin changes here, leave Redwood marked as out of sync for the pending fields,
                  and return control to the Redwood sync button above when the queued job finishes or when you are
                  ready to retry manually.
                </p>
              ) : (
                <>
                  <p>Save and sync to Redwood will queue a background update immediately after this record saves.</p>
                  <p>
                    Save without Redwood sync will keep the admin changes here, mark Redwood as out of sync, and leave
                    the pending fields available for manual sync later.
                  </p>
                </>
              )}
              {!canSkipSync && !isSavePendingMode ? (
                <p>Only super-admins can save Redwood-backed identity changes without syncing.</p>
              ) : null}
            </div>

            <DialogFooter className="gap-3 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              {canSkipSync && !isSavePendingMode ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void submitWithDecision('skip')}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Save Without Redwood Sync
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => void submitWithDecision('sync')}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {primaryActionLabel}
              </Button>
            </DialogFooter>
          </ShadcnWrapper>
        </DialogContent>
      </Dialog>
    </ShadcnWrapper>
  )
}

function getPrimaryActionLabel(saveBehavior: RedwoodClientUpdateSaveBehavior, pendingSyncMode: 'hidden' | 'queued' | 'ready') {
  if (saveBehavior !== 'save-pending') {
    return 'Save And Sync To Redwood'
  }

  return pendingSyncMode === 'queued'
    ? 'Save And Leave Pending Until Current Sync Finishes'
    : 'Save And Leave Pending For Redwood Sync'
}

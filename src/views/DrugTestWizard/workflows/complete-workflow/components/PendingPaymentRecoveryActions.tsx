'use client'

import { useState } from 'react'
import { Ban, CalendarClock, CheckCircle2, Ellipsis, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { guidedWorkflowApi, type GuidedPendingPaymentRecoveryResult } from '../guided-workflow-api'
import type { PendingPaymentRecoveryAction } from '../pending-payment-recovery'

type PendingPaymentRecoveryActionsProps = {
  attendeeName: string
  bookingId: string
  canAccept: boolean
  canReschedule: boolean
  requiresPaymentReview?: boolean
  onCompleted?: (result: GuidedPendingPaymentRecoveryResult) => Promise<void> | void
}

const actionCopy: Record<
  PendingPaymentRecoveryAction,
  { confirmLabel: string; description: (attendeeName: string) => string; title: string }
> = {
  accept: {
    title: 'Accept as an unpaid appointment?',
    description: (attendeeName) =>
      `This creates a new unpaid appointment for ${attendeeName} at the same time, then cancels the pending-payment appointment. Cal.com may send cancellation and confirmation notifications.`,
    confirmLabel: 'Accept unpaid appointment',
  },
  cancel: {
    title: 'Cancel pending-payment appointment?',
    description: (attendeeName) =>
      `This cancels ${attendeeName}'s pending-payment appointment in Cal.com and removes it from today's schedule. No replacement appointment will be created.`,
    confirmLabel: 'Cancel appointment',
  },
  reschedule: {
    title: 'Replace and reschedule this appointment?',
    description: (attendeeName) =>
      `This creates a new unpaid appointment for ${attendeeName} at the current time, cancels the pending-payment appointment, then opens Cal.com to choose another time. If Cal.com is closed, the unpaid appointment remains at its current time.`,
    confirmLabel: 'Replace and reschedule',
  },
}

export function PendingPaymentRecoveryActions({
  attendeeName,
  bookingId,
  canAccept,
  canReschedule,
  requiresPaymentReview = false,
  onCompleted,
}: PendingPaymentRecoveryActionsProps) {
  const [selectedAction, setSelectedAction] = useState<PendingPaymentRecoveryAction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const copy = selectedAction ? actionCopy[selectedAction] : null

  const refresh = async (result: GuidedPendingPaymentRecoveryResult) => {
    if (onCompleted) {
      await onCompleted(result)
      return
    }
    window.location.reload()
  }

  const handleConfirm = async () => {
    if (!selectedAction || isSubmitting) return

    const rescheduleWindow = selectedAction === 'reschedule' ? window.open('about:blank', '_blank') : null
    if (rescheduleWindow) rescheduleWindow.opener = null
    setIsSubmitting(true)

    try {
      const result = await guidedWorkflowApi.recoverPendingPayment({
        action: selectedAction,
        bookingId,
      })

      if (!result.success) {
        rescheduleWindow?.close()
        toast.error(
          result.error || 'The pending-payment appointment could not be changed.',
          result.fallbackHref
            ? {
                action: {
                  label: 'Open Cal.com',
                  onClick: () => window.open(result.fallbackHref || '', '_blank', 'noopener,noreferrer'),
                },
              }
            : undefined,
        )
        if (result.refreshRequired) {
          setSelectedAction(null)
          await refresh(result)
        }
        return
      }

      if (result.warning) toast.warning(result.warning)
      else if (selectedAction === 'cancel') toast.success('Pending-payment appointment cancelled')
      else toast.success('Unpaid replacement appointment created')

      if (selectedAction === 'reschedule' && result.rescheduleHref) {
        if (rescheduleWindow) rescheduleWindow.location.href = result.rescheduleHref
        else {
          toast('The unpaid appointment is ready to reschedule.', {
            action: {
              label: 'Open Cal.com',
              onClick: () => window.open(result.rescheduleHref || '', '_blank', 'noopener,noreferrer'),
            },
          })
        }
      } else {
        rescheduleWindow?.close()
      }

      setSelectedAction(null)
      await refresh(result)
    } catch (error) {
      rescheduleWindow?.close()
      toast.error(error instanceof Error ? error.message : 'The pending-payment appointment could not be changed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mt-2 -mr-2"
              aria-label={`${attendeeName} pending payment options`}
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            {requiresPaymentReview ? (
              <DropdownMenuItem disabled>
                <TriangleAlert />
                Partial payment needs review
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem disabled={!canAccept} onClick={() => setSelectedAction('accept')}>
                  <CheckCircle2 />
                  {canAccept ? 'Accept as unpaid' : 'Accept unavailable'}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canReschedule} onClick={() => setSelectedAction('reschedule')}>
                  <CalendarClock />
                  {canReschedule ? 'Reschedule as unpaid' : 'Link client to reschedule'}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setSelectedAction('cancel')}>
                  <Ban />
                  Cancel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={Boolean(selectedAction)}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setSelectedAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.description(attendeeName)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Go back</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isSubmitting} onClick={() => void handleConfirm()}>
              {isSubmitting ? 'Working...' : copy?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

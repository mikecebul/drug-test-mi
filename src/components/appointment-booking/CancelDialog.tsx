'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Booking } from '@/payload-types'

interface CancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Booking
  onSuccess?: () => void
}

export function CancelDialog({ open, onOpenChange, appointment, onSuccess }: CancelDialogProps) {
  const [cancellationReason, setCancellationReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRecurring = !!appointment.recurringBookingUid

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Reason required', {
        description: 'Please provide a reason for cancellation',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: appointment.id,
          calcomBookingId: appointment.calcomBookingId,
          cancellationReason,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to cancel booking')
      }

      toast.success('Booking cancelled', {
        description: `${appointment.title} has been cancelled successfully.`,
      })

      onOpenChange(false)
      setCancellationReason('')

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast.error('Cancellation failed', {
        description: 'Unable to cancel the booking. Please contact support.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
          <AlertDialogDescription>
            {isRecurring ? (
              <>
                Are you sure you want to cancel all occurrences of "{appointment.title}"? This will cancel the entire
                recurring series and cannot be undone.
              </>
            ) : (
              <>Are you sure you want to cancel "{appointment.title}"? This action cannot be undone.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="reason">Reason for cancellation</Label>
          <Textarea
            id="reason"
            placeholder="Please provide a reason..."
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Keep Appointment</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? 'Cancelling...' : isRecurring ? 'Cancel Series' : 'Cancel Appointment'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

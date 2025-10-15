'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import type { Booking } from '@/payload-types'

interface RescheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Booking
  rescheduleUrl: string
}

export function RescheduleDialog({ open, onOpenChange, appointment, rescheduleUrl }: RescheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>Select a new date and time for "{appointment.title}"</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cal.com Reschedule Embed */}
          <Card>
            <CardContent className="p-0">
              <div className="aspect-[4/3] w-full rounded-lg overflow-hidden">
                <iframe src={rescheduleUrl} className="h-full w-full" frameBorder="0" title="Reschedule appointment" />
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            Powered by Cal.com • Your rescheduled booking will be confirmed via email
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface NewAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  calcomUsername: string
  calcomEventSlug: string
  clientData?: {
    name: string
    email: string
    phone: string
  }
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  calcomUsername,
  calcomEventSlug,
  clientData,
}: NewAppointmentDialogProps) {
  // Get Cal.com embed URL with prefill parameters
  const getCalComEmbedUrl = () => {
    const params = new URLSearchParams()

    if (clientData) {
      params.set('name', clientData.name)
      params.set('email', clientData.email)
      params.set('phone', clientData.phone)
    }

    const queryString = params.toString()
    return `https://cal.com/${calcomUsername}/${calcomEventSlug}${queryString ? `?${queryString}` : ''}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule an Appointment</DialogTitle>
          <DialogDescription>
            Select a date and time for your drug test. Choose recurring option during booking if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cal.com Embed */}
          <div className="bg-card overflow-hidden rounded-lg border">
            <div className="aspect-[4/3] w-full">
              <iframe
                src={getCalComEmbedUrl()}
                className="h-full w-full"
                frameBorder="0"
                title="Book an appointment"
              />
            </div>
          </div>

          <p className="text-muted-foreground text-center text-xs">
            Powered by Cal.com • Your booking will be confirmed via email
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

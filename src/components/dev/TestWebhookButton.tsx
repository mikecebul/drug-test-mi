'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Bug } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TestWebhookButtonProps {
  clientEmail?: string
  clientName?: string
  clientPhone?: string
}

/**
 * Development tool to test Cal.com webhook events
 * Only renders in development mode
 */
export function TestWebhookButton({ clientEmail, clientName, clientPhone }: TestWebhookButtonProps) {
  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    triggerEvent: 'BOOKING_CREATED',
    email: clientEmail || 'test@example.com',
    name: clientName || 'Test User',
    phone: clientPhone || '(231) 555-1234',
    isRecurring: false,
    testType: 'instant',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/test-calcom-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send test webhook')
      }

      toast.success('Test webhook sent!', {
        description: `${formData.triggerEvent} event created for ${formData.email}`,
      })

      setOpen(false)

      // Refresh the page to show the new booking
      router.refresh()
    } catch (error) {
      console.error('Error sending test webhook:', error)
      toast.error('Failed to send test webhook', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bug className="h-4 w-4" />
          Test Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Test Cal.com Webhook</DialogTitle>
          <DialogDescription>Simulate a Cal.com webhook event for development testing</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="triggerEvent">Event Type</Label>
            <Select
              value={formData.triggerEvent}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  triggerEvent: value,
                }))
              }
            >
              <SelectTrigger id="triggerEvent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOOKING_CREATED">BOOKING_CREATED</SelectItem>
                <SelectItem value="BOOKING_CANCELLED">BOOKING_CANCELLED</SelectItem>
                <SelectItem value="BOOKING_RESCHEDULED">BOOKING_RESCHEDULED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  phone: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="testType">Test Type</Label>
            <Select
              value={formData.testType}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  testType: value,
                }))
              }
            >
              <SelectTrigger id="testType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant 15-Panel ($35)</SelectItem>
                <SelectItem value="lab">Lab 11-Panel ($40)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isRecurring"
              checked={formData.isRecurring}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  isRecurring: checked === true,
                }))
              }
            />
            <Label htmlFor="isRecurring" className="text-sm font-normal cursor-pointer">
              Recurring appointment
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Test Webhook'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

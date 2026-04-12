'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { toast } from 'sonner'

export function ToastDevTools() {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-[60]">
        <Button type="button" size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
          Toast Dev Tools
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[20rem]">
      <Card className="border-border bg-card shadow-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">Toast Dev Tools</CardTitle>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setIsOpen(false)}
            aria-label="Close toast dev tools"
          >
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() =>
              toast.success('Registration submitted successfully!', {
                description: 'Please check your email to verify your account.',
              })
            }
          >
            Success
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              toast.error('Registration failed', {
                description: 'Please review your information and try again.',
              })
            }
          >
            Error
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              toast.info('Verification email sent', {
                description: 'Check your inbox and spam folder.',
              })
            }
          >
            Info
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => toast.dismiss()}>
            Dismiss All
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

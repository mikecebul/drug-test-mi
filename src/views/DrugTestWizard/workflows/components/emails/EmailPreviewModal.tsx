'use client'

import React from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, X } from 'lucide-react'

type EmailPreviewModalProps = {
  isOpen: boolean
  onClose: () => void
  emailHtml: string
  subject: string
  recipients: string[]
  emailType: 'client' | 'referral'
}

export function EmailPreviewModal({
  isOpen,
  onClose,
  emailHtml,
  subject,
  recipients,
  emailType,
}: EmailPreviewModalProps) {
  return (
    <Drawer swipeDirection="right" open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-background max-h-dvh overflow-hidden shadow-2xl data-[swipe-direction=right]:w-[min(896px,calc(100vw-16px))] data-[swipe-direction=right]:border-l-2 data-[swipe-direction=right]:sm:max-w-none">
        <DrawerHeader className="border-border shrink-0 border-b">
          <div className="flex items-start justify-between gap-4">
            <DrawerTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Preview
            </DrawerTitle>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close email preview">
              <X className="size-5" />
            </Button>
          </div>
          <DrawerDescription render={<div />} className="space-y-2">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={emailType === 'client' ? 'default' : 'secondary'}>
                  {emailType === 'client' ? 'Client Email' : 'Referral Email'}
                </Badge>
                <Badge variant="outline">screened</Badge>
              </div>
              <div>
                <strong>Subject:</strong> {subject}
              </div>
              <div className="break-words">
                <strong>To:</strong> {recipients.join(', ')}
              </div>
            </div>
          </DrawerDescription>
        </DrawerHeader>

        <div className="mx-4 my-4 min-h-0 flex-1 overflow-hidden rounded-md border sm:mx-6 sm:my-5">
          <iframe
            srcDoc={emailHtml}
            sandbox="allow-same-origin"
            className="h-full min-h-0 w-full"
            title="Email Preview"
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

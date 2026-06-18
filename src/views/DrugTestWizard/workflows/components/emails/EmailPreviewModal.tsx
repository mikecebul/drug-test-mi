'use client'

import React from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Mail } from 'lucide-react'

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
    <Drawer direction="right" open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(64rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
        <DrawerHeader className="border-border border-b px-6 py-5">
          <DrawerTitle className="flex items-center gap-2 text-2xl tracking-tight">
            <Mail className="h-5 w-5" />
            Email Preview
          </DrawerTitle>
          <DrawerDescription asChild className="space-y-2">
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
              <div>
                <strong>To:</strong> {recipients.join(', ')}
              </div>
            </div>
          </DrawerDescription>
        </DrawerHeader>

        <div className="mx-6 my-5 flex-1 overflow-auto rounded-md border">
          <iframe
            srcDoc={emailHtml}
            sandbox="allow-same-origin"
            className="h-full min-h-150 w-full"
            title="Email Preview"
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

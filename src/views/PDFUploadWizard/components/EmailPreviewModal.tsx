'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview
          </DialogTitle>
          <DialogDescription asChild className="space-y-2">
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
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border">
          <iframe
            srcDoc={emailHtml}
            sandbox="allow-same-origin"
            className="h-full min-h-150 w-full"
            title="Email Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

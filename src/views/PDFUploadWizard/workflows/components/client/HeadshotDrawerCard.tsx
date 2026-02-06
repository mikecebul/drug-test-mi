'use client'

import { useState } from 'react'
import { useDocumentDrawer } from '@payloadcms/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/utilities/cn'
import { Camera } from 'lucide-react'
import { formatDateOnly } from '@/lib/date-utils'
import { toast } from 'sonner'
import { linkHeadshot } from './linkHeadshot'

interface HeadshotDrawerCardProps {
  client: {
    id: string
    firstName: string
    lastName: string
    middleInitial?: string | null
    email: string
    dob?: string | null
    headshot?: string | null
    headshotId?: string | null
    phone?: string | null
  }
  onHeadshotLinked?: (url: string, docId: string) => void
}

/**
 * Client card that opens Payload's native DocumentDrawer to create or edit a
 * private-media headshot. Payload handles the entire upload pipeline (resize,
 * thumbnail, S3). On save we link the doc to the client.
 */
export function HeadshotDrawerCard({ client, onHeadshotLinked }: HeadshotDrawerCardProps) {
  const [headshotUrl, setHeadshotUrl] = useState<string | undefined>(client.headshot ?? undefined)
  const [currentHeadshotId, setCurrentHeadshotId] = useState<string | undefined>(client.headshotId ?? undefined)

  // Single hook — id is reactive: undefined = create mode, string = edit mode
  const [DocumentDrawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({
    collectionSlug: 'private-media',
    id: currentHeadshotId,
  })

  const handleSave = async ({ doc, operation }: { doc: { id: string | number }; operation: string }) => {
    if (operation === 'create') {
      // New headshot created
      try {
        const result = await linkHeadshot(client.id, String(doc.id))
        if (result.success && result.url && result.id) {
          setHeadshotUrl(result.url)
          onHeadshotLinked?.(result.url, result.id)
          toast.success('Headshot uploaded and linked')

          // Close drawer first to avoid state conflicts when updating currentHeadshotId
          closeDrawer()

          // Delay state update to ensure drawer is fully closed
          setTimeout(() => {
            setCurrentHeadshotId(result.id)
          }, 100)
        }
      } catch (error) {
        console.error('[HeadshotDrawerCard] Failed to link headshot:', error)
        toast.error('Headshot was saved but could not be linked to the client')
      }
    } else if (operation === 'update') {
      // Existing headshot updated - re-fetch to get new URL
      try {
        const result = await linkHeadshot(client.id, String(doc.id))
        if (result.success && result.url && result.id) {
          setHeadshotUrl(result.url)
          onHeadshotLinked?.(result.url, result.id)
          toast.success('Headshot updated')
          closeDrawer()
        }
      } catch (error) {
        console.error('[HeadshotDrawerCard] Failed to update headshot:', error)
        toast.error('Headshot was saved but could not be linked to the client')
      }
    }
  }

  return (
    <>
      <div
        className={cn(
          'relative w-full rounded-lg border p-6',
          'text-primary bg-info-muted border-info',
          'flex h-full items-center gap-6',
        )}
      >
        {/* Avatar with camera button overlay */}
        <div className="relative shrink-0">
          <Avatar className="size-16 lg:size-24">
            <AvatarImage src={headshotUrl} alt={`${client.firstName} ${client.lastName}`} />
            <AvatarFallback className="text-lg">
              {client.firstName?.charAt(0)}
              {client.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <button
            type="button"
            aria-label="Upload headshot photo"
            onClick={openDrawer}
            className={cn(
              'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm',
              'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
              headshotUrl ? 'size-6 lg:size-7' : 'size-7 lg:size-8',
            )}
          >
            <Camera className={headshotUrl ? 'size-3 lg:size-3.5' : 'size-3.5 lg:size-4'} />
          </button>
        </div>

        {/* Client details */}
        <div className="flex flex-1 flex-col space-y-3">
          <h3 className="text-2xl leading-tight font-bold tracking-tight lg:text-3xl">
            {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
            {client.lastName}
          </h3>

          <div className="text-muted-foreground">
            <p>{client.email}</p>
            {client.dob && <p>DOB: {formatDateOnly(client.dob)}</p>}
            {client.phone && <p>Phone: {client.phone}</p>}
          </div>
        </div>
      </div>

      <DocumentDrawer
        initialData={!currentHeadshotId ? {
          documentType: 'headshot',
          relatedClient: client.id,
          alt: `${client.firstName} ${client.lastName}`,
        } : undefined}
        onSave={handleSave}
        redirectAfterCreate={false}
      />
    </>
  )
}

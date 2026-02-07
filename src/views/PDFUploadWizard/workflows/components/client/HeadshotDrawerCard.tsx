'use client'

import { useState } from 'react'
import { useDocumentDrawer } from '@payloadcms/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/utilities/cn'
import { Camera } from 'lucide-react'
import { formatDateOnly } from '@/lib/date-utils'
import { toast } from 'sonner'
import { linkHeadshot } from './linkHeadshot'

/**
 * Delay before updating currentHeadshotId after closing the drawer.
 * This prevents a race condition where the drawer re-renders in edit mode
 * while the close animation is still running (PayloadCMS v3.74 default transition).
 * Increase this value if you see flickering or drawer state issues on slower devices.
 */
const DRAWER_CLOSE_DELAY_MS = 150

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

        if (!result.success) {
          // Handle specific error from server action
          const errorMessage = result.error || 'Failed to link headshot to client'
          console.error('[HeadshotDrawerCard] Link failed:', {
            clientId: client.id,
            headshotId: String(doc.id),
            error: errorMessage,
            errorCode: result.errorCode,
          })

          toast.error(
            `Upload failed: ${errorMessage}. The headshot was saved but not linked. Please try again or contact support.`,
            { duration: 5000 }
          )
          return // Don't update state if link failed
        }

        if (!result.url || !result.id) {
          console.error('[HeadshotDrawerCard] Missing URL or ID in success response:', result)
          toast.error('Headshot was linked but URL is missing. Please refresh the page.')
          return
        }

        // Only update state on complete success
        setHeadshotUrl(result.url)
        onHeadshotLinked?.(result.url, result.id)
        toast.success('Headshot uploaded and linked successfully')

        // Close drawer first to prevent race condition where drawer re-renders with new ID before unmounting
        closeDrawer()

        // Delay state update until drawer completes its close animation and unmount
        setTimeout(() => {
          setCurrentHeadshotId(result.id)
        }, DRAWER_CLOSE_DELAY_MS)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[HeadshotDrawerCard] Unexpected error during headshot creation:', {
          clientId: client.id,
          headshotId: String(doc.id),
          error: errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
        })

        toast.error(
          `An unexpected error occurred during headshot upload: ${errorMessage}. Please try again or contact support.`,
          { duration: 6000 }
        )
      }
    } else if (operation === 'update') {
      // Existing headshot updated - re-fetch to get new URL
      try {
        const result = await linkHeadshot(client.id, String(doc.id))

        if (!result.success) {
          const errorMessage = result.error || 'Failed to update headshot link'
          console.error('[HeadshotDrawerCard] Update link failed:', {
            clientId: client.id,
            headshotId: String(doc.id),
            error: errorMessage,
            errorCode: result.errorCode,
          })

          toast.error(
            `Update failed: ${errorMessage}. The changes were saved but not linked. Please try again.`,
            { duration: 5000 }
          )
          return
        }

        if (!result.url || !result.id) {
          console.error('[HeadshotDrawerCard] Missing URL or ID in update response:', result)
          toast.error('Headshot was updated but URL is missing. Please refresh the page.')
          return
        }

        setHeadshotUrl(result.url)
        onHeadshotLinked?.(result.url, result.id)
        toast.success('Headshot updated successfully')
        closeDrawer()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[HeadshotDrawerCard] Unexpected error during headshot update:', {
          clientId: client.id,
          headshotId: String(doc.id),
          error: errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
        })

        toast.error(
          `An unexpected error occurred during headshot update: ${errorMessage}. Please try again.`,
          { duration: 6000 }
        )
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

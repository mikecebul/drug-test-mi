import React from 'react'
import type { DefaultServerCellComponentProps } from 'payload'
import type { Media } from '@/payload-types'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'

export const HeadshotCell = async ({ cellData, rowData }: DefaultServerCellComponentProps) => {
  // cellData is just the media ID string
  if (!cellData || typeof cellData !== 'string') {
    return null
  }

  const payload = await getPayload({ config })

  // Fetch the media document
  const media = await payload.findByID({
    collection: 'media',
    id: cellData,
  })

  if (!media || !media.thumbnailURL) {
    return null
  }

  // Build the link to the client record
  const clientId = rowData?.id
  const editUrl = `/admin/collections/clients/${clientId}`

  return (
    <div className="flex items-center justify-center">
      <Link href={editUrl} className="">
        <img
          src={media.thumbnailURL}
          alt={media.alt || 'Client headshot'}
          className="size-14 rounded-full object-cover transition-opacity hover:opacity-80"
        />
      </Link>
    </div>
  )
}

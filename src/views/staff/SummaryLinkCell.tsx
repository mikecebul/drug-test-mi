'use client'

import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'

export default function SummaryLinkCell({ cellData, rowData, collectionSlug }: DefaultCellComponentProps) {
  const { user } = useAuth()
  return (
    <Link href={`/admin/collections/${collectionSlug}/${rowData.id}${user?.role === 'superAdmin' ? '' : '/summary'}`}>
      {typeof cellData === 'string' ? cellData : 'View record'}
    </Link>
  )
}

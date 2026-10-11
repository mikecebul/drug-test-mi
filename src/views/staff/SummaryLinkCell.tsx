'use client'

import { DefaultCell } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'

export default function SummaryLinkCell(props: DefaultCellComponentProps) {
  return (
    <DefaultCell
      {...props}
      link={props.link ?? true}
      linkURL={`/admin/collections/${props.collectionSlug}/${props.rowData.id}/summary`}
    />
  )
}

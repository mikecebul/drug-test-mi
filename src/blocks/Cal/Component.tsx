'use client'

import { CalendarEmbedBlock as CalendarEmbedBlockType } from '@/payload-types'
import Cal from '@calcom/embed-react'

export const CalendarEmbedBlock = ({
  description: _description,
  title: _title,
  calLink = 'mikecebul',
}: CalendarEmbedBlockType) => {
  return (
    <Cal
      calLink={calLink ?? 'midrugtest'}
      config={{ theme: 'light' }}
      style={{ width: '100%', height: '100%', overflow: 'scroll' }}
    />
  )
}

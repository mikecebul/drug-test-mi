'use client'

import { cn } from '@/utilities/cn'
import { useRowLabel } from '@payloadcms/ui'

const RowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ medicationName: string; status: 'active' | 'discontinued' }>()
  const isDiscontinued = data.status === 'discontinued'

  return (
    <div
      className={cn('font-bold text-orange-400 capitalize dark:font-medium', {
        'text-muted-foreground': isDiscontinued,
      })}
    >
      {`${(rowNumber ?? 0) + 1} - ${data.medicationName || 'Untitled'}`} {isDiscontinued && '(Discontinued)'}
    </div>
  )
}

export default RowLabel

'use client'

import { useRowLabel } from '@payloadcms/ui'

const RowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ medicationName: string }>()
  return (
    <div className="font-bold capitalize dark:font-medium dark:text-orange-400">{`${(rowNumber ?? 0) + 1} - ${data.medicationName || 'Untitled'}`}</div>
  )
}

export default RowLabel

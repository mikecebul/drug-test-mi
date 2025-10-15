'use client'

import { useRowLabel } from '@payloadcms/ui'

export const TestsRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{
    name?: string
    price?: number
    isActive?: boolean
  }>()

  const displayName = data?.name || `Test ${rowNumber}`
  const price = data?.price ? `$${data.price}` : ''
  const status = data?.isActive === false ? ' (Inactive)' : ''

  return (
    <div>
      {displayName} {price && `- ${price}`}{status}
    </div>
  )
}

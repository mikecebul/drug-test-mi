import { Text } from '@react-email/components'
import * as React from 'react'
import { label, value } from '../utils/styles'

interface DetailRowProps {
  label: string
  value: string | React.ReactNode
}

/**
 * DetailRow component displays a label-value pair
 * Used for displaying client information, test details, etc.
 */
export function DetailRow({ label: labelText, value: valueContent }: DetailRowProps) {
  return (
    <Text style={{ margin: '8px 0', fontSize: '14px', lineHeight: '20px' }}>
      <span style={label}>{labelText}:</span>{' '}
      <span style={value}>{valueContent}</span>
    </Text>
  )
}

DetailRow.PreviewProps = {
  label: 'Client Name',
  value: 'John Doe',
} as DetailRowProps

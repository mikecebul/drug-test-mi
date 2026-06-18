'use client'

import Cal from '@calcom/embed-react'
import type { CalBookingConfig } from '@/utilities/calcom-config'

interface CalInlineProps {
  calUsername: string
  config?: CalBookingConfig
}

export function CalInline({ calUsername = 'midrugtest', config = {} }: CalInlineProps) {
  const calConfig = {
    theme: 'light' as const,
    ...config,
  }

  return <Cal calLink={calUsername} config={calConfig} style={{ width: '100%' }} />
}

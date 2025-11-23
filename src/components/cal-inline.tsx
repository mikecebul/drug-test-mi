'use client'

import Cal from '@calcom/embed-react'

interface CalInlineProps {
  calUsername: string
  config?: Record<string, any>
}

export function CalInline({ calUsername = 'midrugtest', config = {} }: CalInlineProps) {
  const calConfig = {
    theme: 'light' as const,
    ...config,
  }

  return <Cal calLink={calUsername} config={calConfig} style={{ width: '100%' }} />
}

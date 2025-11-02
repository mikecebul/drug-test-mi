'use client'

import Cal from '@calcom/embed-react'

interface CalEmbedProps {
  calUsername: string
  config?: Record<string, any>
}

export function CalEmbed({ calUsername = 'midrugtest', config = {} }: CalEmbedProps) {
  const calConfig = {
    theme: 'light' as const,
    ...config,
  }

  return (
    <div className="w-full">
      <Cal calLink={calUsername} config={calConfig} style={{ width: '100%', overflow: 'scroll' }} />
    </div>
  )
}

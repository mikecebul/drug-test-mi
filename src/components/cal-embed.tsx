'use client'

import Cal from '@calcom/embed-react'

interface CalEmbedProps {
  calLink: string
  testerName?: string
  userData?: {
    name: string
    email: string
  }
}

export function CalEmbed({ calLink, userData }: CalEmbedProps) {
  const config: any = {
    theme: 'light',
  }

  // Pre-fill user data if available - according to Cal.com docs, name and email go directly in config
  if (userData) {
    config.name = userData.name
    config.email = userData.email
  }

  return (
    <div className="w-full">
      <Cal
        calLink={calLink}
        config={config}
        style={{ width: '100%', height: '600px', overflow: 'scroll' }}
      />
    </div>
  )
}

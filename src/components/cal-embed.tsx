"use client"

import Cal from '@calcom/embed-react'

interface CalEmbedProps {
  calUsername: string
  testerName: string
}

export function CalEmbed({ calUsername, testerName }: CalEmbedProps) {
  return (
    <div className="w-full">
      <Cal 
        calLink={calUsername} 
        config={{ theme: 'light' }} 
        style={{ width: "100%", height: "600px", overflow: "scroll" }}
      />
    </div>
  )
}
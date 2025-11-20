'use client'

import dynamic from 'next/dynamic'

// Disable SSR for components that use browser-only APIs or dynamic values
// These components are loaded only on the client to prevent hydration mismatches
export const GoogleMapDynamic = dynamic(
  () => import('./GoogleMap').then((mod) => ({ default: mod.GoogleMap })),
  { ssr: false },
)

export const CopyrightDynamic = dynamic(
  () => import('./Copyright').then((mod) => ({ default: mod.Copyright })),
  { ssr: false },
)

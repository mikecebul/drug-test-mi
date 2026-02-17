'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { consumeVersionSkewToastSignal } from '@/lib/errors/versionSkew'

const VERSION_UPDATE_MESSAGE = 'App updated. You are now on the latest version.'

export function VersionSkewToastHydrator() {
  useEffect(() => {
    if (consumeVersionSkewToastSignal()) {
      toast.info(VERSION_UPDATE_MESSAGE)
    }
  }, [])

  return null
}

'use client'

import { isVersionSkewError, queueVersionSkewReload, toError } from '@/lib/errors/versionSkew'

function maybeReloadForVersionSkew(error: Error & { digest?: string }) {
  if (typeof window === 'undefined') {
    return
  }

  if (queueVersionSkewReload(error)) {
    window.location.reload()
  }
}

export async function safeServerAction<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    const normalizedError = toError(error) as Error & { digest?: string }

    if (isVersionSkewError(normalizedError)) {
      maybeReloadForVersionSkew(normalizedError)
    }

    throw normalizedError
  }
}

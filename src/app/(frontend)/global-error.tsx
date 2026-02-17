'use client'

import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'
import { isVersionSkewError, queueVersionSkewReload } from '@/lib/errors/versionSkew'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  if (isVersionSkewError(error) && queueVersionSkewReload(error)) {
    window.location.reload()
    return null
  }

  return (
    <html>
      <body>
        <div className="space-y-4 p-6">
          <NextError statusCode={0} />
          <button
            className="rounded bg-black px-4 py-2 text-white"
            onClick={() => reset()}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

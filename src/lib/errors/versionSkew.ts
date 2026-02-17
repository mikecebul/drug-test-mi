const VERSION_SKEW_RELOAD_TOKEN_SEPARATOR = '::'
export const VERSION_SKEW_RELOAD_STORAGE_KEY = 'last-version-reload'
export const VERSION_SKEW_TOAST_STORAGE_KEY = 'pending-version-skew-toast'

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === 'string') {
    return new Error(error)
  }

  return new Error('Unknown error')
}

export function isVersionSkewError(error: unknown): boolean {
  const message = toError(error).message.toLowerCase()

  return (
    message.includes('failed to find server action') ||
    (message.includes('server action') && message.includes('not found on the server')) ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk') ||
    message.includes('dynamically imported module')
  )
}

export function getSkewReloadToken(error: Error & { digest?: string }): string {
  return `${error.digest || ''}${VERSION_SKEW_RELOAD_TOKEN_SEPARATOR}${error.message || 'unknown-error'}`
}

export function queueVersionSkewReload(error: Error & { digest?: string }): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const nextToken = getSkewReloadToken(error)
  const lastToken = window.sessionStorage.getItem(VERSION_SKEW_RELOAD_STORAGE_KEY)

  if (lastToken === nextToken) {
    return false
  }

  window.sessionStorage.setItem(VERSION_SKEW_RELOAD_STORAGE_KEY, nextToken)
  window.sessionStorage.setItem(VERSION_SKEW_TOAST_STORAGE_KEY, '1')
  return true
}

export function consumeVersionSkewToastSignal(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const hasPendingToast = window.sessionStorage.getItem(VERSION_SKEW_TOAST_STORAGE_KEY) === '1'

  if (hasPendingToast) {
    window.sessionStorage.removeItem(VERSION_SKEW_TOAST_STORAGE_KEY)
  }

  return hasPendingToast
}

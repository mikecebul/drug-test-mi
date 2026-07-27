import type { CollectionAfterErrorHook } from 'payload'

function getRequestPath(url: string | undefined): string | null {
  if (!url) return null

  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

export const logClientOperationError: CollectionAfterErrorHook = ({ error, req }) => {
  req.payload.logger.error({
    msg: '[clients] Client collection operation failed',
    err: error,
    method: req.method,
    path: getRequestPath(req.url),
    userCollection: req.user?.collection || null,
    userId: req.user?.id ? String(req.user.id) : null,
  })
}

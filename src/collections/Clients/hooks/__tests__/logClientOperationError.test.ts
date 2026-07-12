import { describe, expect, it, vi } from 'vitest'

import { logClientOperationError } from '../logClientOperationError'

describe('logClientOperationError', () => {
  it('records failed client mutations with request context', async () => {
    const loggerError = vi.fn()
    const error = new Error('Invalid referral value')

    await logClientOperationError({
      error,
      req: {
        method: 'PATCH',
        payload: { logger: { error: loggerError } },
        url: 'https://example.test/api/clients/client-1?depth=0',
        user: { collection: 'admins', id: 'admin-1' },
      },
    } as never)

    expect(loggerError).toHaveBeenCalledWith({
      msg: '[clients] Client collection operation failed',
      err: error,
      method: 'PATCH',
      path: '/api/clients/client-1',
      userCollection: 'admins',
      userId: 'admin-1',
    })
  })
})

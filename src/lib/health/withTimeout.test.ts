import { describe, expect, test, vi } from 'vitest'

import { withTimeout } from './withTimeout'

describe('withTimeout', () => {
  test('runs timeout cleanup and preserves the timeout error', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn(() => {
      throw new Error('cleanup failed')
    })

    try {
      const operation = withTimeout(new Promise<never>(() => undefined), 50, 'operation timed out', { onTimeout })
      const rejection = expect(operation).rejects.toThrow('operation timed out')

      await vi.advanceTimersByTimeAsync(50)
      await rejection

      expect(onTimeout).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})

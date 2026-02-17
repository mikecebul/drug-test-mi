import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeServerAction } from './safeServerAction'
import { VERSION_SKEW_TOAST_STORAGE_KEY } from '@/lib/errors/versionSkew'

const originalWindow = globalThis.window

function createWindowMock() {
  const store = new Map<string, string>()
  const reload = vi.fn()

  return {
    mockWindow: {
      location: { reload },
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
      },
    } as unknown as Window,
    reload,
    store,
  }
}

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  } else {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    })
  }
  vi.restoreAllMocks()
})

describe('safeServerAction', () => {
  it('returns successful results unchanged', async () => {
    const result = await safeServerAction(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('reloads once for version skew errors and rethrows', async () => {
    const { mockWindow, reload, store } = createWindowMock()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    await expect(
      safeServerAction(async () => {
        throw new Error('Failed to find Server Action "abc"')
      }),
    ).rejects.toThrow('Failed to find Server Action')

    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.get(VERSION_SKEW_TOAST_STORAGE_KEY)).toBe('1')
  })

  it('does not reload for non-skew errors', async () => {
    const { mockWindow, reload } = createWindowMock()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    await expect(
      safeServerAction(async () => {
        throw new Error('Validation failed')
      }),
    ).rejects.toThrow('Validation failed')

    expect(reload).not.toHaveBeenCalled()
  })

  it('deduplicates reload by token', async () => {
    const { mockWindow, reload } = createWindowMock()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    const action = async () => {
      throw new Error('ChunkLoadError: Loading chunk 123 failed')
    }

    await expect(safeServerAction(action)).rejects.toThrow()
    await expect(safeServerAction(action)).rejects.toThrow()

    expect(reload).toHaveBeenCalledTimes(1)
  })
})

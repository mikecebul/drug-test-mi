import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  consumeVersionSkewToastSignal,
  getSkewReloadToken,
  isVersionSkewError,
  queueVersionSkewReload,
  toError,
} from './versionSkew'

const originalWindow = globalThis.window

function createWindowMock() {
  const store = new Map<string, string>()

  return {
    mockWindow: {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
      },
    } as unknown as Window,
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

describe('versionSkew utils', () => {
  it('detects version skew signatures', () => {
    expect(isVersionSkewError(new Error('Failed to find Server Action "abc"'))).toBe(true)
    expect(isVersionSkewError(new Error('Server Action "abc" was not found on the server'))).toBe(true)
    expect(isVersionSkewError(new Error('ChunkLoadError: Loading chunk 123 failed'))).toBe(true)
    expect(isVersionSkewError(new Error('Error loading chunk'))).toBe(true)
    expect(isVersionSkewError(new Error('Failed to fetch dynamically imported module'))).toBe(true)
  })

  it('does not flag normal errors as version skew', () => {
    expect(isVersionSkewError(new Error('Validation failed: email is required'))).toBe(false)
    expect(isVersionSkewError(new Error('Network error: request timed out'))).toBe(false)
    expect(isVersionSkewError(new Error('Unexpected token < in JSON at position 0'))).toBe(false)
  })

  it('normalizes unknown values to Error', () => {
    expect(toError('plain string')).toBeInstanceOf(Error)
    expect(toError(123).message).toBe('Unknown error')
  })

  it('builds deterministic reload token', () => {
    const error = new Error('Failed to find Server Action') as Error & { digest?: string }
    error.digest = 'digest123'
    expect(getSkewReloadToken(error)).toBe('digest123::Failed to find Server Action')
  })

  it('queues reload signal once per token and consumes toast signal once', () => {
    const { mockWindow } = createWindowMock()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
    })

    const error = new Error('Failed to find Server Action') as Error & { digest?: string }
    error.digest = 'digest123'

    expect(queueVersionSkewReload(error)).toBe(true)
    expect(queueVersionSkewReload(error)).toBe(false)
    expect(consumeVersionSkewToastSignal()).toBe(true)
    expect(consumeVersionSkewToastSignal()).toBe(false)
  })
})

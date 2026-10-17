import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

test.each([undefined, '', '   '])('provides valid local metadata when the server URL is %j', async (value) => {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', value)
  vi.resetModules()
  const { baseUrl } = await import('./baseUrl')
  expect(new URL(baseUrl).origin).toBe('http://localhost:3000')
})

test('preserves the configured server URL', async () => {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', ' https://example.com ')
  vi.resetModules()
  const { baseUrl } = await import('./baseUrl')
  expect(baseUrl).toBe('https://example.com')
})

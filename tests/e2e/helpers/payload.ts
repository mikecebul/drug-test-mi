import type { BasePayload } from 'payload'
import { ensureDotEnvLoaded } from './env'

let cachedPayloadPromise: Promise<BasePayload> | null = null

export async function getPayloadClient(): Promise<BasePayload> {
  ensureDotEnvLoaded()

  if (!cachedPayloadPromise) {
    cachedPayloadPromise = (async () => {
      const [{ getPayload }, { default: config }] = await Promise.all([
        import('payload'),
        import('../../../src/payload.config'),
      ])
      return getPayload({ config })
    })()
  }

  return cachedPayloadPromise
}

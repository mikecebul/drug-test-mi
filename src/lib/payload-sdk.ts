// lib/payload-sdk.ts
import { PayloadSDK } from '@payloadcms/sdk'
import type { Config } from '@/payload-types' // Your generated types

const sdkBaseURL = '/api'

export const sdk = new PayloadSDK<Config>({
  baseURL: sdkBaseURL,
})

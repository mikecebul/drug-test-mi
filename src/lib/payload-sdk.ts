// lib/payload-sdk.ts
import { PayloadSDK } from '@payloadcms/sdk'
import type { Config } from '@/payload-types' // Your generated types

export const sdk = new PayloadSDK<Config>({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL + '/api' || 'http://localhost:3000/api',
})
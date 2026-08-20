import { withPayload } from '@payloadcms/next/withPayload'
import redirects from './redirects.js'
import { withSentryConfig } from '@sentry/nextjs'

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  // PDF.js is server-only and dynamically loads its legacy worker/runtime files.
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
  images: {
    remotePatterns: [
      ...[
        baseUrl,
        'https://maps.googleapis.com',
        process.env.NEXT_PUBLIC_S3_HOSTNAME ? `https://${process.env.NEXT_PUBLIC_S3_HOSTNAME}` : null,
      ]
        .filter(Boolean)
        .map((item) => {
          try {
            const url = new URL(item)
            return {
              hostname: url.hostname,
              protocol: url.protocol.replace(':', ''),
            }
          } catch (_error) {
            console.warn(`Invalid URL: ${item}`)
            return null
          }
        })
        .filter(Boolean),
    ],
  },
  reactStrictMode: true,
  redirects,
}

// Sentry Configuration
const sentryConfig = {
  org: 'mikecebul',
  project: process.env.NEXT_PUBLIC_IS_LIVE === 'false' ? 'drug-test-branch-test' : 'drug-test-mi',
  sentryUrl: 'https://monitor.mikecebul.com/',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
}

export default withSentryConfig(withPayload(nextConfig, { devBundleServerPackages: false }), sentryConfig)

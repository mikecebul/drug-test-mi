import type { Metadata } from 'next'

import type { Page } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { baseUrl } from './baseUrl'

export const generateMeta = async (args: { doc: Page }): Promise<Metadata> => {
  const { doc } = args || {}

  // Get fallback OG image based on page slug
  const getFallbackOgImage = (slug?: string | string[]) => {
    const slugString = Array.isArray(slug) ? slug.join('/') : slug || 'home'

    switch (slugString) {
      case 'schedule':
        return '/api/og/schedule'
      default:
        return '/api/og'
    }
  }

  const ogImage =
    typeof doc?.meta?.metadata?.image === 'object' &&
    !!doc.meta.metadata.image &&
    typeof doc.meta.metadata.image.sizes?.meta === 'object' &&
    'url' in doc.meta.metadata.image.sizes.meta
      ? process.env.NEXT_PUBLIC_SERVER_URL !== 'localhost:3000'
        ? doc.meta.metadata.image.sizes.meta.url
        : `${baseUrl}${doc.meta.metadata.image.url}`
      : getFallbackOgImage(doc?.slug || undefined)

  const title = doc?.meta?.metadata?.title
    ? doc.meta.metadata.title + ' | Drug Test MI'
    : 'Drug Test MI'

  return {
    description: doc?.meta?.metadata?.description,
    openGraph: mergeOpenGraph({
      description: doc?.meta?.metadata?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}

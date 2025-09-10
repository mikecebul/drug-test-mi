import type { Metadata } from 'next'
import { baseUrl } from './baseUrl'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description:
    'MI Drug Test is a leading provider of drug testing services in Chrarlevoix, Michigan.',
  images: [
    {
      url: `${baseUrl}/og.png`,
    },
  ],
  siteName: 'Drug Test MI',
  title: 'Drug Test MI',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}

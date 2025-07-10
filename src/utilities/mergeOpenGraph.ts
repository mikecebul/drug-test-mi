import type { Metadata } from 'next'
import { baseUrl } from './baseUrl'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'Drug Test MI is a leading provider of drug testing services in Chrarlevoix, Michigan.',
  images: [
    {
      url: `${baseUrl}/golf-hero.jpg`,
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

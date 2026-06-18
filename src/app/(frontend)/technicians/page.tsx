import type { Metadata } from 'next'

import React, { cache } from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'

import { LivePreviewListener } from '@/components/LivePreviewListener'
import { RenderBlocks } from '@/blocks/RenderBlocks'
import { generateMeta } from '@/utilities/generateMeta'
import type { Page } from '@/payload-types'

const fallbackLayout: Page['layout'] = [
  {
    blockType: 'hero',
    type: 'mediumImpact',
    mediumImpact: {
      title: 'Our Technicians',
      heading: 'h1',
      description:
        'Meet our drug testing professionals. Each technician is trained, experienced, and committed to providing professional and discreet testing services.',
    },
  },
  {
    blockType: 'techniciansBlock',
    showIntro: false,
    maxTechnicians: 6,
  },
  {
    blockType: 'cta',
    title: 'Need to schedule a test?',
    description:
      'Create your account to book appointments, manage your testing history, and receive results.',
    links: [
      {
        link: {
          type: 'custom',
          url: '/register',
          label: 'Register',
          appearance: 'default',
          newTab: false,
        },
      },
    ],
  },
]

const fallbackPage = {
  id: 'technicians-fallback',
  title: 'Technicians',
  slug: 'technicians',
  layout: fallbackLayout,
  meta: {
    metadata: {
      title: 'Our Technicians',
      description:
        'Meet our certified drug testing technicians. Professional, discreet, and experienced testing services.',
    },
  },
  updatedAt: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
} as Page

export async function generateMetadata(): Promise<Metadata> {
  const page = await queryTechniciansPage()

  return generateMeta({ doc: page || fallbackPage })
}

export default async function TechniciansPage() {
  const { isEnabled: draft } = await draftMode()
  const page = await queryTechniciansPage()
  const layout = page?.layout?.length ? page.layout : fallbackLayout

  return (
    <main>
      {draft && <LivePreviewListener />}
      <RenderBlocks blocks={layout} />
    </main>
  )
}

const queryTechniciansPage = cache(async () => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    draft,
    limit: 1,
    where: {
      slug: {
        equals: 'technicians',
      },
    },
  })

  return (result.docs?.[0] || null) as Page | null
})

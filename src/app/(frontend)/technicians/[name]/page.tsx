import type { Metadata } from 'next'
import React, { cache } from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import { TechnicianDetailPage } from '@/components/TechnicianDetailPage'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const technicians = await payload.find({
    collection: 'technicians',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    where: {
      isActive: {
        equals: true,
      },
    },
    select: {
      name: true,
    },
  })

  const params = technicians.docs
    ?.map((technician) => ({
      name: technician.name.toLowerCase().replace(/\s+/g, '-'),
    }))

  return params || []
}

type Args = {
  params: Promise<{
    name: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { name } = await paramsPromise
  
  const technician = await queryTechnicianByName({
    name: name.replace(/-/g, ' '),
  })

  if (!technician) {
    return notFound()
  }

  return <TechnicianDetailPage technician={technician} />
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { name } = await paramsPromise
  const technician = await queryTechnicianByName({
    name: name.replace(/-/g, ' '),
  })

  if (!technician) {
    return {
      title: 'Technician Not Found',
    }
  }

  return {
    title: `Schedule with ${technician.name} | Drug Test MI`,
    description: `Book an appointment with ${technician.name}, a certified drug testing technician. ${technician.bio}`,
  }
}

const queryTechnicianByName = cache(async ({ name }: { name: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'technicians',
    limit: 1,
    where: {
      and: [
        {
          name: {
            contains: name,
          },
        },
        {
          isActive: {
            equals: true,
          },
        },
      ],
    },
    depth: 1,
  })

  return result.docs?.[0] || null
})
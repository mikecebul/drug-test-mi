import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { TechniciansGrid } from '@/components/TechniciansGrid'
import type { TechniciansBlock } from '@/payload-types'

export default async function TechniciansBlockComponent({
  heading,
  description,
  maxTechnicians,
}: TechniciansBlock) {
  const payload = await getPayload({ config: configPromise })

  const technicians = await payload.find({
    collection: 'technicians',
    where: {
      isActive: {
        equals: true,
      },
    },
    sort: 'name',
    depth: 1,
    limit: maxTechnicians || 6,
  })

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        <div className="mb-8 text-center sm:mb-12 lg:mb-16">
          <h2 className="text-foreground mb-4 text-3xl font-bold sm:text-4xl lg:text-5xl">
            {heading || 'Our Technicians'}
          </h2>
          <p className="text-muted-foreground mx-auto max-w-3xl text-lg sm:text-xl">
            {description ||
              'Meet our drug testing professionals. Each technician is trained, experienced, and committed to providing professional and discreet testing services.'}
          </p>
        </div>

        <TechniciansGrid technicians={technicians.docs} />
      </div>
    </div>
  )
}

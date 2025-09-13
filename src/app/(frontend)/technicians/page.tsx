import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { TechniciansGrid } from '@/components/TechniciansGrid'

export const metadata: Metadata = {
  title: 'Our Technicians | Drug Test MI',
  description: 'Meet our certified drug testing technicians. Professional, discreet, and experienced testing services.',
}

export default async function TechniciansPage() {
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
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Our Technicians
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Meet our drug testing professionals. Each technician is trained, experienced, 
            and committed to providing professional and discreet testing services.
          </p>
        </div>

        <TechniciansGrid technicians={technicians.docs} />
      </div>
    </div>
  )
}
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { TechniciansGrid } from '@/components/TechniciansGrid'
import type { TechniciansBlock } from '@/payload-types'
import Container from '@/components/Container'
import { HeroMedium } from '@/components/Hero/HeroMedium'

export default async function TechniciansBlockComponent({
  heading,
  description,
  maxTechnicians,
  schedulingInfo,
  links,
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

  console.log("Schedule:", schedulingInfo)

  return (
    <Container className="space-y-16">
      <HeroMedium
        title={heading || 'Our technicians'}
        description={
          description ||
          'Meet our drug testing professionals. Each technician is trained, experienced, and committed to providing professional and discreet testing services.'
        }
      />

      <TechniciansGrid
        technicians={technicians.docs}
        schedulingInfo={schedulingInfo}
        links={links}
      />
    </Container>
  )
}

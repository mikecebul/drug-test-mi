import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SchedulePageClient } from './Component.client'
import type { SchedulePageBlock as SchedulePageBlockType } from '@/payload-types'

export const SchedulePageBlock = async ({ title }: SchedulePageBlockType) => {
  const payload = await getPayload({ config: configPromise })
  
  const technicians = await payload.find({
    collection: 'technicians',
    where: {
      isActive: {
        equals: true,
      },
    },
    depth: 1,
  })

  return <SchedulePageClient title={title || undefined} technicians={technicians.docs} />
}
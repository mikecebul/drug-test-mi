import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { QuickScheduleClient } from './Component.client'

export const QuickScheduleBlock = async () => {
  const payload = await getPayload({ config: configPromise })

  const technicians = await payload.find({
    collection: 'technicians',
    where: {
      isActive: {
        equals: true,
      },
    },
    limit: 4, // Show only first 4 for the quick schedule preview
    depth: 1,
  })

  return <QuickScheduleClient technicians={technicians.docs} />
}
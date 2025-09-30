import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DashboardTechnicianDetail } from './DashboardTechnicianDetail'
import { cache } from 'react'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{
    slug: string
  }>
}

const queryTechnicianBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'technicians',
    limit: 1,
    where: {
      and: [
        {
          name: {
            contains: slug.replace(/-/g, ' '),
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

export default async function DashboardTechnicianPage({ params: paramsPromise }: Args) {
  try {
    const { slug } = await paramsPromise
    const client = await getAuthenticatedClient()

    // Get technician data
    const technician = await queryTechnicianBySlug({ slug })

    if (!technician) {
      return notFound()
    }

    const userData = {
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
    }

    return <DashboardTechnicianDetail technician={technician} userData={userData} />
  } catch (error) {
    redirect('/sign-in?redirect=/dashboard')
  }
}
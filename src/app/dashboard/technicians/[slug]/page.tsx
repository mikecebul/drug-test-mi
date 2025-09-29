import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DashboardTechnicianDetail } from './DashboardTechnicianDetail'
import { cache } from 'react'

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

async function getTechnicianData(slug: string) {
  const headersList = await headers()
  const payload = await getPayload({ config })

  // Get authenticated user
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    redirect('/sign-in?redirect=/dashboard/technicians/' + slug)
  }

  if (user.collection !== 'clients') {
    redirect('/admin')
  }

  // Get technician data
  const technician = await queryTechnicianBySlug({ slug })

  if (!technician) {
    return null
  }

  return {
    technician,
    user,
  }
}

export default async function DashboardTechnicianPage({ params: paramsPromise }: Args) {
  try {
    const { slug } = await paramsPromise
    const data = await getTechnicianData(slug)

    if (!data) {
      return notFound()
    }

    return <DashboardTechnicianDetail technician={data.technician} />
  } catch (error) {
    redirect('/sign-in?redirect=/dashboard')
  }
}
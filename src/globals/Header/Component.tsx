import { HeaderClient } from './Component.client'
import React from 'react'

import type { CompanyInfo, Header } from '@/payload-types'
import { getPayload } from 'payload'
import payloadConfig from '@payload-config'
import { headers } from 'next/headers'

export async function Header() {
  const headersList = await headers()
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: headersList })

  const header: Header = await payload.findGlobal({
    slug: 'header',
    depth: 1,
  })

  const { contact }: CompanyInfo = await payload.findGlobal({
    slug: 'company-info',
    depth: 1,
  })

  return (
    <HeaderClient
      authUser={user ? { collection: user.collection, id: user.id } : null}
      header={header}
      contact={contact}
    />
  )
}

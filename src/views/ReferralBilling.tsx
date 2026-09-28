import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, SetStepNav } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { ReferralBillingClient } from './ReferralBillingClient'

export default async function ReferralBilling({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  if (!req.user || req.user.collection !== 'admins') redirect('/admin/login')

  const referrals: Array<{ id: string; name: string; relationTo: 'courts' | 'employers'; billingEmail: string }> = []
  for (const relationTo of ['courts', 'employers'] as const) {
    let page = 1
    do {
      const result = await req.payload.find({
        collection: relationTo,
        where: { isBillable: { equals: true } },
        depth: 0,
        page,
        limit: 100,
      })
      referrals.push(
        ...result.docs.map((item) => ({
          id: String(item.id),
          name: item.name,
          relationTo,
          billingEmail: item.billingEmail || '',
        })),
      )
      if (!result.hasNextPage) break
      page += 1
    } while (true)
  }
  referrals.sort((a, b) => a.name.localeCompare(b.name))

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SetStepNav nav={[{ label: 'Referral Billing', url: '/referral-billing' }]} />
      <Gutter>
        <ReferralBillingClient referrals={referrals} />
      </Gutter>
    </DefaultTemplate>
  )
}

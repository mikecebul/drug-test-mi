import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, SetStepNav } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { CollectPaymentClient } from './CollectPaymentClient'

export default async function CollectPayment({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  if (req.user?.collection !== 'admins') redirect('/admin/login')
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
      <SetStepNav nav={[{ label: 'Collect Payment', url: '/collect-payment' }]} />
      <Gutter>
        <NuqsAdapter>
          <CollectPaymentClient />
        </NuqsAdapter>
      </Gutter>
    </DefaultTemplate>
  )
}

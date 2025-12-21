import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, SetStepNav } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { DrugTestTrackerClient } from './DrugTestTrackerClient'
import { redirect } from 'next/dist/client/components/navigation'

export default function DrugTestTracker({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const navItem = [
    {
      label: 'Drug Test Tracker',
      url: '/drug-test-tracker',
    },
  ]

  const user = initPageResult.req?.user
  if (!user || user?.collection !== 'admins') {
    redirect('/admin/login')
  }

  return (
    <DefaultTemplate
      i18n={initPageResult.req?.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req?.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req?.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SetStepNav nav={navItem} />
      <Gutter>
        <DrugTestTrackerClient />
      </Gutter>
    </DefaultTemplate>
  )
}

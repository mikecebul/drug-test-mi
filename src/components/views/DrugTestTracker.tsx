import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, SetStepNav } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { DrugTestTrackerClient } from './DrugTestTrackerClient'

export default function DrugTestTracker({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const navItem = [
    {
      label: 'Drug Test Tracker',
      url: '/drug-test-tracker',
    },
  ]

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
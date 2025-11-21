import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import type { AdminViewProps } from 'payload'
import { PDFUploadWizardClient } from './PDFUploadWizardClient'

export default function PDFUploadWizard({ initPageResult, params, searchParams }: AdminViewProps) {
  const navItem = [
    {
      label: 'PDF Upload Wizard',
      url: '/drug-test-upload',
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
      <div className="-mx-[var(--gutter-h)] px-8 py-6 max-w-full" style={{ fontSize: '16px', transform: 'scale(1.15)', transformOrigin: 'top center', marginBottom: '15%' }}>
        <PDFUploadWizardClient />
      </div>
    </DefaultTemplate>
  )
}

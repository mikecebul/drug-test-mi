import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import type { AdminViewProps } from 'payload'
import { PDFUploadWizardClient } from './PDFUploadWizardClient'
import ShadcnWrapper from '@/components/ShadcnWrapper'
import { WizsrdContainer } from './components/WizardContainer'
import { redirect } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'

export default function PDFUploadWizard({ initPageResult, params, searchParams }: AdminViewProps) {
  const navItem = [
    {
      label: 'PDF Upload Wizard',
      url: '/drug-test-upload',
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
      <ShadcnWrapper>
        <WizsrdContainer>
          <PDFUploadWizardClient />
        </WizsrdContainer>
        <Toaster />
      </ShadcnWrapper>
    </DefaultTemplate>
  )
}

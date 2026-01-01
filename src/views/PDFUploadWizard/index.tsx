import React from 'react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { PDFUploadWizardClient } from './PDFUploadWizardClient'
import ShadcnWrapper from '@/components/ShadcnWrapper'
import { WizardContainer } from './components/main-wizard/WizardContainer'
import { redirect } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'
import { ResetFormButton } from './components/main-wizard/ResetFormButton'

export default function PDFUploadWizard({ initPageResult, params, searchParams }: AdminViewServerProps) {
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
      <NuqsAdapter>
        <ShadcnWrapper>
          <WizardContainer>
            <div className="relative">
              <PDFUploadWizardClient />
              <ResetFormButton />
            </div>
          </WizardContainer>
          <Toaster richColors toastOptions={{}} />
        </ShadcnWrapper>
      </NuqsAdapter>
    </DefaultTemplate>
  )
}

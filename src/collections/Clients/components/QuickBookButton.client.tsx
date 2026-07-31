'use client'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { QuickBookControl } from '@/components/quick-book/QuickBookControl.client'
import type { ClientGender } from '@/lib/client-gender'

interface QuickBookButtonClientProps {
  clientName: string
  clientEmail: string
  clientGender?: ClientGender
  clientPhone?: string
  recommendedTestTypeId?: string
  recommendedTestTypeValue?: string
  calLink?: string
}

/**
 * Client component that renders the one-click Quick Book button.
 * Opens Cal.com modal for the specific drug-test event with prefilled data.
 */
export function QuickBookButtonClient({
  clientName,
  clientEmail,
  clientGender,
  clientPhone,
  recommendedTestTypeId,
  recommendedTestTypeValue,
  calLink,
}: QuickBookButtonClientProps) {
  return (
    <ShadcnWrapper className="pb-0">
      <QuickBookControl
        clientName={clientName}
        clientEmail={clientEmail}
        clientGender={clientGender}
        clientPhone={clientPhone}
        recommendedTestTypeId={recommendedTestTypeId}
        recommendedTestTypeValue={recommendedTestTypeValue}
        calLink={calLink}
      />
    </ShadcnWrapper>
  )
}

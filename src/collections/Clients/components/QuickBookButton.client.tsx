'use client'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { QuickBookControl } from '@/components/quick-book/QuickBookControl.client'

interface QuickBookButtonClientProps {
  clientName: string
  clientEmail: string
  clientPhone?: string
  recommendedTestTypeId?: string
  recommendedTestTypeValue?: string
}

/**
 * Client component that renders the one-click Quick Book button.
 * Opens Cal.com modal for the specific drug-test event with prefilled data.
 */
export function QuickBookButtonClient({
  clientName,
  clientEmail,
  clientPhone,
  recommendedTestTypeId,
  recommendedTestTypeValue,
}: QuickBookButtonClientProps) {
  return (
    <ShadcnWrapper className="pb-0">
      <QuickBookControl
        clientName={clientName}
        clientEmail={clientEmail}
        clientPhone={clientPhone}
        recommendedTestTypeId={recommendedTestTypeId}
        recommendedTestTypeValue={recommendedTestTypeValue}
      />
    </ShadcnWrapper>
  )
}

import * as React from 'react'
import type { ScreenedEmailData } from '@/collections/DrugTests/email/types'
import { ConfirmationDecisionNotice } from './components/ConfirmationDecisionNotice'
import { ResultRow } from './components/ResultRow'
import { SubstancesSection } from './components/SubstancesSection'
import { TestEmail } from './components/TestEmail'

/** One screening template for clients and referrals, including instant tests. */
export function ScreenedEmail(data: ScreenedEmailData & { confirmationWindowClosed?: boolean }) {
  return (
    <TestEmail
      data={data}
      title="Screening results"
      preview={`Drug test results for ${data.clientName}`}
      isDilute={data.isDilute}
      attachment
    >
      {data.initialScreenResult === 'inconclusive' ? (
        <ResultRow name="Screening result" status="Inconclusive" tone="warning" />
      ) : (
        <SubstancesSection
          detectedSubstances={data.detectedSubstances}
          expectedPositives={data.expectedPositives}
          unexpectedPositives={data.unexpectedPositives}
        />
      )}
      <ConfirmationDecisionNotice {...data} />
    </TestEmail>
  )
}

ScreenedEmail.PreviewProps = {
  clientName: 'Alex Morgan',
  clientDob: '1990-01-14',
  collectionDate: '2026-10-09T14:30:00Z',
  testType: '11-panel-lab',
  initialScreenResult: 'unexpected-positive',
  detectedSubstances: ['amphetamines', 'buprenorphine'],
  expectedPositives: ['buprenorphine'],
  unexpectedPositives: ['amphetamines'],
  unexpectedNegatives: [],
  isDilute: false,
  confirmationDecision: 'pending-decision',
  confirmationHoldUntil: '2026-11-10T03:59:59Z',
  breathalyzerTaken: false,
  breathalyzerResult: null,
} satisfies ScreenedEmailData

export default ScreenedEmail

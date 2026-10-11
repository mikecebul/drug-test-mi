import * as React from 'react'
import type { CompleteEmailData } from '@/collections/DrugTests/email/types'
import { ConfirmationSection } from './components/ConfirmationSection'
import { Notice } from './components/Notice'
import { TestEmail } from './components/TestEmail'

/** One final-results template for clients and referrals. */
export function CompleteEmail(data: CompleteEmailData) {
  return (
    <TestEmail
      data={data}
      title={data.confirmationResults?.length ? 'Confirmation results' : 'Final results'}
      preview={`Final drug test results for ${data.clientName}`}
      isDilute={data.isDilute}
      attachment
    >
      <ConfirmationSection {...data} />
      {data.confirmationResults?.length ? (
        <Notice title="Confirmation complete" tone="success">
          Final report attached.
        </Notice>
      ) : null}
    </TestEmail>
  )
}

CompleteEmail.PreviewProps = {
  ...{
    clientName: 'Alex Morgan',
    clientDob: '1990-01-14',
    collectionDate: '2026-10-09T14:30:00Z',
    testType: '11-panel-lab',
    initialScreenResult: 'unexpected-positive',
    detectedSubstances: ['buprenorphine'],
    expectedPositives: ['buprenorphine'],
    unexpectedPositives: [],
    unexpectedNegatives: [],
    isDilute: false,
    breathalyzerTaken: false,
    breathalyzerResult: null,
  },
  confirmationResults: [
    { substance: 'amphetamines', result: 'confirmed-negative' },
    { substance: 'buprenorphine', result: 'confirmed-positive' },
  ],
  finalStatus: 'expected-positive',
} satisfies CompleteEmailData

export default CompleteEmail

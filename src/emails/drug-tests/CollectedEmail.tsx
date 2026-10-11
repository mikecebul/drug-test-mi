import * as React from 'react'
import type { CollectedEmailData } from '@/collections/DrugTests/email/types'
import { Notice } from './components/Notice'
import { TestEmail } from './components/TestEmail'

/** Collection notifications remain referral-only. No results or report are claimed yet. */
export function CollectedEmail(data: CollectedEmailData) {
  return (
    <TestEmail data={data} title="Lab collection" preview={`Drug test sample collected for ${data.clientName}`}>
      <Notice title="Sample collected" tone="neutral">
        Being sent to the lab for screening.
        <br />
        Results will be emailed when available.
      </Notice>
    </TestEmail>
  )
}

CollectedEmail.PreviewProps = {
  clientName: 'Alex Morgan',
  clientDob: '1990-01-14',
  collectionDate: '2026-10-09T14:30:00Z',
  testType: '11-panel-lab',
  breathalyzerTaken: false,
  breathalyzerResult: null,
} satisfies CollectedEmailData

export default CollectedEmail

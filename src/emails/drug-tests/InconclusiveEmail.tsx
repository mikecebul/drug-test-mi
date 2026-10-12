import * as React from 'react'
import type { InconclusiveEmailData } from '@/collections/DrugTests/email/types'
import { Notice } from './components/Notice'
import { TestEmail } from './components/TestEmail'

export function InconclusiveEmail(data: InconclusiveEmailData) {
  return (
    <TestEmail data={data} title="Test results" preview={`Inconclusive drug test result for ${data.clientName}`}>
      <Notice title="Inconclusive result" tone="warning">
        The sample could not be screened.{data.reason ? ` Reason: ${data.reason}` : ''}
        <br />
        Contact Mike to arrange a new test.
      </Notice>
    </TestEmail>
  )
}

InconclusiveEmail.PreviewProps = {
  ...{
    clientName: 'Alex Morgan',
    clientDob: '1990-01-14',
    collectionDate: '2026-10-09T14:30:00Z',
    testType: '11-panel-lab',
    breathalyzerTaken: false,
    breathalyzerResult: null,
  },
  reason: 'Sample damaged in transit',
} satisfies InconclusiveEmailData

export default InconclusiveEmail

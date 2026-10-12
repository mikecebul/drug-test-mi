import { Hr, Text } from '@react-email/components'
import * as React from 'react'
import type { CollectedEmailData } from '@/collections/DrugTests/email/types'
import { formatEmailDate, formatTestType } from '../utils/formatters'
import { rule, text } from '../utils/theme'
import { BreathalyzerResult } from './BreathalyzerResult'
import { ClientIdentity } from './ClientIdentity'
import { DetailRow } from './DetailRow'
import { EmailLayout } from './EmailLayout'
import { Notice } from './Notice'
import { ReportAttachment } from './ReportAttachment'

export function TestEmail({
  data,
  title,
  preview,
  children,
  isDilute = false,
  attachment = false,
}: {
  data: CollectedEmailData
  title: string
  preview: string
  children: React.ReactNode
  isDilute?: boolean
  attachment?: boolean
}) {
  return (
    <EmailLayout preview={preview}>
      <ClientIdentity name={data.clientName} dob={data.clientDob} headshotDataUri={data.clientHeadshotDataUri} />
      <Text style={{ ...text, fontWeight: 600, marginBottom: '8px' }}>{title}</Text>
      <DetailRow label="Test type" value={formatTestType(data.testType).replace(' Test', '')} />
      <DetailRow label="Collected" value={formatEmailDate(data.collectionDate)} />
      <Hr style={{ ...rule, margin: '16px 0 0' }} />
      {children}
      {isDilute && (
        <Notice title="Dilute sample" tone="warning">
          The sample was dilute and may affect result accuracy.
        </Notice>
      )}
      {data.breathalyzerTaken && <BreathalyzerResult bac={data.breathalyzerResult} />}
      {attachment && (
        <ReportAttachment
          filename={
            data.reportFilename || (data.testType.endsWith('-instant') ? 'Instant report.pdf' : 'Lab report.pdf')
          }
        />
      )}
    </EmailLayout>
  )
}

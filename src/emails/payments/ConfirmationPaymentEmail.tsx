import { Button, Column, Hr, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { ClientIdentity } from '../drug-tests/components/ClientIdentity'
import { DetailRow } from '../drug-tests/components/DetailRow'
import { EmailLayout } from '../drug-tests/components/EmailLayout'
import { Notice } from '../drug-tests/components/Notice'
import { formatEmailDate, formatSubstance, formatTestType } from '../drug-tests/utils/formatters'
import { colors, rule, text } from '../drug-tests/utils/theme'
import { APP_TIMEZONE } from '@/lib/date-utils'

export type ConfirmationPaymentEmailProps = {
  clientName: string
  amountDue: number
  checkoutUrl: string
  testType: string
  collectionDate?: string | null
  substances: string[]
  holdUntil?: string | null
  linkExpiresAt?: string | null
}

function formatLinkExpiry(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
    timeZoneName: 'short',
  }).format(new Date(value))
}

export function ConfirmationPaymentEmail(props: ConfirmationPaymentEmailProps) {
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(props.amountDue)
  return (
    <EmailLayout preview={`Confirmation testing: ${amount} due. Pay securely through Stripe.`}>
      <ClientIdentity name={props.clientName} />
      <Text style={{ ...text, fontWeight: 600, marginBottom: '8px' }}>Confirmation testing</Text>
      <DetailRow label="Test type" value={formatTestType(props.testType).replace(' Test', '')} />
      {props.collectionDate && <DetailRow label="Collected" value={formatEmailDate(props.collectionDate)} />}
      {props.substances.length > 0 && (
        <DetailRow label="Substances" value={props.substances.map(formatSubstance).join(', ')} />
      )}
      <Hr style={{ ...rule, margin: '16px 0' }} />
      <Section>
        <Row>
          <Column style={{ verticalAlign: 'middle' }}>
            <Text style={{ ...text, color: colors.muted }}>Confirmation balance due</Text>
          </Column>
          <Column style={{ verticalAlign: 'middle', textAlign: 'right' }}>
            <Text style={{ ...text, fontSize: '24px', lineHeight: '30px', fontWeight: 700 }}>{amount}</Text>
          </Column>
        </Row>
        <Button
          href={props.checkoutUrl}
          style={{
            ...text,
            backgroundColor: colors.blue,
            color: '#ffffff',
            borderRadius: '6px',
            fontWeight: 600,
            padding: '12px 20px',
            marginTop: '16px',
            textAlign: 'center',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          Pay securely
        </Button>
        <Text style={{ ...text, color: colors.muted, marginTop: '8px' }}>
          Secure card payment through Stripe.
          {props.linkExpiresAt && (
            <>
              <br />
              Link expires {formatLinkExpiry(props.linkExpiresAt)}.
            </>
          )}
        </Text>
      </Section>
      <Notice
        title={props.holdUntil ? `Lab hold ends ${formatEmailDate(props.holdUntil)}` : 'Payment before confirmation'}
      >
        Staff will request confirmation from the lab after payment clears.
      </Notice>
    </EmailLayout>
  )
}

ConfirmationPaymentEmail.PreviewProps = {
  clientName: 'Alex Morgan',
  amountDue: 45,
  checkoutUrl: 'https://checkout.stripe.com/example',
  testType: '11-panel-lab',
  collectionDate: '2026-10-09T14:30:00Z',
  substances: ['amphetamines'],
  holdUntil: '2026-11-08T14:30:00Z',
  linkExpiresAt: '2026-10-11T14:30:00Z',
} satisfies ConfirmationPaymentEmailProps

export default ConfirmationPaymentEmail

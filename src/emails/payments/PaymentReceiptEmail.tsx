import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import * as React from 'react'

export type PaymentReceiptType = 'credit-added' | 'paid-in-full' | 'partial'

export type PaymentReceiptEmailProps = {
  appliedToPreviousBalances: number
  appliedToToday: number
  cashReceived: number
  clientCreditApplied: number
  clientCreditBalance: number
  clientName: string
  creditAdded: number
  paymentDate: string
  paymentMethod: string
  receiptType: PaymentReceiptType
  remainingBalance: number
  testName: string
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Section style={detailRow}>
      <Text style={detailLabel}>{label}</Text>
      <Text style={detailValue}>{value}</Text>
    </Section>
  )
}

function getReceiptHeading(receiptType: PaymentReceiptType) {
  if (receiptType === 'partial') return 'Partial payment received'
  if (receiptType === 'credit-added') return 'Payment received and credit added'
  return 'Payment received in full'
}

function getStatusMessage(props: PaymentReceiptEmailProps) {
  if (props.receiptType === 'partial') {
    return `${currency.format(props.remainingBalance)} remains due on your account.`
  }
  if (props.receiptType === 'credit-added') {
    return `${currency.format(props.creditAdded)} was added to your client credit for a future balance.`
  }
  return 'Your current account balance is paid in full.'
}

export function PaymentReceiptEmail(props: PaymentReceiptEmailProps) {
  const totalApplied = props.appliedToPreviousBalances + props.appliedToToday
  const totalTendered = props.cashReceived + props.clientCreditApplied
  const heading = getReceiptHeading(props.receiptType)

  return (
    <Html>
      <Head />
      <Preview>
        {heading} — {currency.format(totalTendered)}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandHeader}>
            <Text style={brand}>MI DRUG TEST</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>PAYMENT RECEIPT</Text>
            <Heading style={headingStyle}>{heading}</Heading>
            <Text style={intro}>Hello {props.clientName},</Text>
            <Text style={intro}>Thank you. This email confirms the payment recorded on your account.</Text>

            <Section style={statusCard}>
              <Text style={statusAmount}>{currency.format(totalTendered)}</Text>
              <Text style={statusMessage}>{getStatusMessage(props)}</Text>
            </Section>

            <Heading as="h2" style={sectionHeading}>
              Receipt details
            </Heading>
            <Section style={detailsSection}>
              <Detail label="Date" value={props.paymentDate} />
              <Detail label="Payment method" value={props.paymentMethod} />
              <Detail label="Today's test" value={props.testName} />
              {props.cashReceived > 0 ? (
                <Detail label="Cash received" value={currency.format(props.cashReceived)} />
              ) : null}
              {props.clientCreditApplied > 0 ? (
                <Detail label="Client credit applied" value={currency.format(props.clientCreditApplied)} />
              ) : null}
              {props.appliedToPreviousBalances > 0 ? (
                <Detail
                  label="Applied to previous balances"
                  value={currency.format(props.appliedToPreviousBalances)}
                />
              ) : null}
              <Detail label="Applied to today's test" value={currency.format(props.appliedToToday)} />
              <Detail label="Total applied" value={currency.format(totalApplied)} />
              {props.creditAdded > 0 ? (
                <Detail label="New client credit" value={currency.format(props.creditAdded)} />
              ) : null}
            </Section>

            <Hr style={divider} />
            <Section style={balanceSection}>
              <Detail label="Remaining balance" value={currency.format(props.remainingBalance)} />
              <Detail label="Client credit balance" value={currency.format(props.clientCreditBalance)} />
            </Section>

            <Text style={footer}>Questions about this receipt? Contact MI Drug Test.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

PaymentReceiptEmail.PreviewProps = {
  appliedToPreviousBalances: 10,
  appliedToToday: 25,
  cashReceived: 50,
  clientCreditApplied: 0,
  clientCreditBalance: 15,
  clientName: 'Jordan Smith',
  creditAdded: 15,
  paymentDate: 'August 6, 2026 at 12:30 PM ET',
  paymentMethod: 'Cash',
  receiptType: 'credit-added',
  remainingBalance: 0,
  testName: '17-Panel Instant',
} satisfies PaymentReceiptEmailProps

const body = {
  backgroundColor: '#f3f4f6',
  color: '#172033',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: 0,
  padding: '32px 12px',
}

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #dfe3e8',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '620px',
  overflow: 'hidden',
}

const brandHeader = {
  backgroundColor: '#0b2948',
  padding: '20px 36px',
}

const brand = {
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: '700',
  letterSpacing: '1.8px',
  margin: 0,
}

const content = { padding: '36px' }

const eyebrow = {
  color: '#667085',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '1.1px',
  margin: '0 0 10px',
}

const headingStyle = {
  color: '#172033',
  fontSize: '30px',
  lineHeight: '38px',
  margin: '0 0 20px',
}

const intro = {
  color: '#475467',
  fontSize: '15px',
  lineHeight: '23px',
  margin: '0 0 10px',
}

const statusCard = {
  backgroundColor: '#eef7f1',
  border: '1px solid #b7ddc2',
  borderLeft: '5px solid #26834a',
  borderRadius: '8px',
  margin: '26px 0 30px',
  padding: '20px 22px',
}

const statusAmount = {
  color: '#172033',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0 0 6px',
}

const statusMessage = {
  color: '#475467',
  fontSize: '14px',
  lineHeight: '21px',
  margin: 0,
}

const sectionHeading = {
  color: '#172033',
  fontSize: '18px',
  lineHeight: '26px',
  margin: '0 0 14px',
}

const detailsSection = { margin: 0 }

const detailRow = {
  borderBottom: '1px solid #eef0f3',
  display: 'table',
  padding: '10px 0',
  width: '100%',
}

const detailLabel = {
  color: '#687083',
  display: 'table-cell',
  fontSize: '13px',
  lineHeight: '20px',
  margin: 0,
  width: '58%',
}

const detailValue = {
  color: '#172033',
  display: 'table-cell',
  fontSize: '13px',
  fontWeight: '700',
  lineHeight: '20px',
  margin: 0,
  textAlign: 'right' as const,
}

const divider = {
  borderColor: '#dfe3e8',
  margin: '24px 0 14px',
}

const balanceSection = { margin: 0 }

const footer = {
  color: '#687083',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '28px 0 0',
}

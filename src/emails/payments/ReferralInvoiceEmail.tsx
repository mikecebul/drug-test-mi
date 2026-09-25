import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text, render } from '@react-email/components'
import * as React from 'react'

export const REFERRAL_CHECK_FOOTER =
  'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.'

type InvoiceEmailData = {
  referralName: string
  month: string
  amount: number
  invoiceNumber: string | null
  dueDate: number | null
  paymentUrl: string | null
  replacesInvoiceNumber: string | null
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export async function buildReferralInvoiceEmail(data: InvoiceEmailData) {
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${data.month}-01T12:00:00Z`),
  )
  const dueDate = data.dueDate
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'America/Detroit' }).format(
        new Date(data.dueDate * 1000),
      )
    : null
  const subject =
    `MI Drug Test ${data.replacesInvoiceNumber ? 'replacement ' : ''}invoice ${data.invoiceNumber || ''} — ${monthLabel}`.replace(
      /\s+—/,
      ' —',
    )
  const html = await render(
    <Html>
      <Head />
      <Preview>Your {monthLabel} invoice from MI Drug Test is attached as a PDF.</Preview>
      <Body
        style={{ backgroundColor: '#f3f4f6', color: '#172033', fontFamily: 'Arial, sans-serif', padding: '24px 12px' }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #dfe3e8',
            borderRadius: 12,
            maxWidth: 620,
            margin: '0 auto',
          }}
        >
          <Section style={{ backgroundColor: '#0b2948', padding: '18px 32px' }}>
            <Text style={{ color: '#ffffff', fontWeight: 700, letterSpacing: 1.5, margin: 0 }}>MI DRUG TEST</Text>
          </Section>
          <Section style={{ padding: '30px 32px' }}>
            <Heading style={{ fontSize: 27 }}>Your {monthLabel} invoice</Heading>
            <Text>Hello {data.referralName},</Text>
            <Text>
              Your invoice for {currency.format(data.amount)} is attached as a PDF. You can print it for your records or
              to process a check payment.
            </Text>
            {data.replacesInvoiceNumber && (
              <Text>
                This replaces invoice {data.replacesInvoiceNumber}. Please disregard the earlier invoice and use this
                one for payment.
              </Text>
            )}
            {data.invoiceNumber && <Text>Invoice number: {data.invoiceNumber}</Text>}
            {dueDate && <Text>Payment due: {dueDate}</Text>}
            {data.paymentUrl && (
              <Text>
                You can also <Link href={data.paymentUrl}>view the invoice and pay online</Link>.
              </Text>
            )}
            <Hr />
            <Text>Prefer to pay by check? Make checks payable to MI Drug Test and mail them to:</Text>
            <Text>
              MI Drug Test
              <br />
              410 W Robinson St
              <br />
              Charlevoix, MI 49720
            </Text>
            <Text>
              Thank you,
              <br />
              MI Drug Test
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>,
  )
  return { subject, html }
}

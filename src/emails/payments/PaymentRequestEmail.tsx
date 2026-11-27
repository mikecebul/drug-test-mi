import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'

type PaymentRequestEmailProps = {
  charges: { label: string; amount: string }[]
  total: string
  checkoutUrl: string
}

export default function PaymentRequestEmail({ charges, total, checkoutUrl }: PaymentRequestEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{total} due for your MI Drug Test charges.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandHeader}>
            <Text style={brand}>MI DRUG TEST</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Payment request</Heading>
            <Text style={intro}>Review your charges below and pay securely by card through Stripe.</Text>

            <table cellPadding="0" cellSpacing="0" style={summary} aria-label="Payment summary">
              <thead>
                <tr>
                  <th scope="col" style={tableHeading}>Charge</th>
                  <th scope="col" style={{ ...tableHeading, ...amountCell }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {charges.map(({ label, amount }, index) => (
                  <tr key={index}>
                    <td style={chargeCell}>{label}</td>
                    <td style={{ ...chargeCell, ...amountCell, fontWeight: 700 }}>{amount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" style={{ ...totalCell, textAlign: 'left' }}>Total due</th>
                  <td style={{ ...totalCell, ...amountCell, fontSize: '22px' }}>{total}</td>
                </tr>
              </tfoot>
            </table>

            <Section style={action}>
              <Button href={checkoutUrl} style={payButton}>Pay securely by card</Button>
            </Section>
            <Text style={footer}>Questions about these charges? Contact MI Drug Test.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

PaymentRequestEmail.PreviewProps = {
  charges: [
    { label: '03/04/2026 confirmation fee', amount: '$45.00' },
    { label: '03/10/2026 confirmation fee', amount: '$45.00' },
    { label: '03/18/2026 screen', amount: '$40.00' },
    { label: '03/24/2026 screen', amount: '$40.00' },
  ],
  total: '$170.00',
  checkoutUrl: 'https://www.midrugtest.example/api/bundled-checkout/example',
} satisfies PaymentRequestEmailProps

const body: CSSProperties = {
  backgroundColor: '#f3f4f6',
  color: '#172033',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: 0,
  padding: '28px 12px',
}

const container: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #dfe3e8',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '620px',
  width: '100%',
  overflow: 'hidden',
}

const brandHeader: CSSProperties = { backgroundColor: '#0b2948', padding: '18px 28px' }

const brand: CSSProperties = {
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '1.8px',
  margin: 0,
}

const content: CSSProperties = { padding: '28px' }

const heading: CSSProperties = {
  color: '#172033',
  fontSize: '30px',
  lineHeight: '38px',
  margin: '0 0 8px',
}

const intro: CSSProperties = {
  color: '#475467',
  fontSize: '15px',
  lineHeight: '23px',
  margin: '0 0 24px',
}

const summary: CSSProperties = {
  border: '1px solid #dfe3e8',
  borderCollapse: 'separate',
  borderRadius: '8px',
  width: '100%',
}

const tableHeading: CSSProperties = {
  backgroundColor: '#f4f6f9',
  color: '#475467',
  fontSize: '13px',
  fontWeight: 700,
  padding: '11px 14px',
  textAlign: 'left',
}

const chargeCell: CSSProperties = {
  borderTop: '1px solid #e6eaf0',
  fontSize: '14px',
  lineHeight: '20px',
  padding: '12px 14px',
}

const amountCell: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' }

const totalCell: CSSProperties = {
  backgroundColor: '#edf4fb',
  borderTop: '1px solid #d4e2f1',
  color: '#0b2948',
  fontSize: '15px',
  fontWeight: 700,
  lineHeight: '26px',
  padding: '12px 14px',
}

const action: CSSProperties = { padding: '24px 0 0' }

const payButton: CSSProperties = {
  backgroundColor: '#174e86',
  border: '1px solid #174e86',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'block',
  fontSize: '15px',
  fontWeight: 700,
  lineHeight: '20px',
  padding: '14px 20px',
  textAlign: 'center',
  textDecoration: 'none',
}

const footer: CSSProperties = {
  color: '#475467',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '16px 0 0',
}

import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import * as React from 'react'

export type NewClientRegistrationEmailProps = {
  adminUrl: string
  clientName: string
  dateOfBirth?: string
  email: string
  gender?: string
  phone?: string
  recipients: Array<{ email: string; name?: string }>
  referralName: string
  referralType: string
  registeredAt: string
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text style={detailLine}>
      <span style={detailLineLabel}>{label}</span>
      <span style={detailLineValue}>{value}</span>
    </Text>
  )
}

export function NewClientRegistrationEmail({
  adminUrl,
  clientName,
  dateOfBirth,
  email,
  gender,
  phone,
  recipients,
  referralName,
  referralType,
  registeredAt,
}: NewClientRegistrationEmailProps) {
  const referralLabel = `${referralType.toUpperCase()} REFERRAL`

  return (
    <Html>
      <Head />
      <Preview>
        {clientName} registered — referred by {referralName}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandHeader}>
            <Text style={brand}>MI DRUG TEST</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>NEW CLIENT REGISTRATION</Text>
            <Heading style={heading}>{clientName} registered</Heading>

            <Section style={referralCard}>
              <Text style={referralBadge}>{referralLabel}</Text>
              <Text style={referralCaption}>Referred by</Text>
              <Text style={referralNameStyle}>{referralName}</Text>
            </Section>

            <Heading as="h2" style={sectionHeading}>
              Client details
            </Heading>

            <Section style={detailsSection}>
              <Detail label="Email" value={email} />
              <Detail label="Phone" value={phone || 'Not provided'} />
              <Detail label="Date of birth" value={dateOfBirth || 'Not provided'} />
              <Detail label="Gender" value={gender || 'Not specified'} />
            </Section>

            {recipients.length > 0 ? (
              <Section style={recipientsSection}>
                <Text style={detailLabel}>Results recipients</Text>
                {recipients.map((recipient) => (
                  <Text key={recipient.email} style={recipientRow}>
                    {recipient.name ? `${recipient.name} · ` : ''}
                    {recipient.email}
                  </Text>
                ))}
              </Section>
            ) : null}

            <Button href={adminUrl} style={button}>
              View client in admin
            </Button>

            <Hr style={divider} />
            <Text style={footer}>Registered {registeredAt}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

NewClientRegistrationEmail.PreviewProps = {
  adminUrl: 'https://midrugtest.com/admin/collections/clients/client-id',
  clientName: 'Brett Farve',
  dateOfBirth: 'October 10, 1969',
  email: 'brett@example.com',
  gender: 'Male',
  phone: '(248) 555-3434',
  recipients: [{ name: 'Jane Smith', email: 'jane@charlevoixcounty.org' }],
  referralName: 'Charlevoix County 33rd Circuit Court',
  referralType: 'Court',
  registeredAt: 'July 19, 2026 at 10:42 AM ET',
} satisfies NewClientRegistrationEmailProps

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

const heading = {
  color: '#172033',
  fontSize: '30px',
  lineHeight: '38px',
  margin: '0 0 28px',
}

const referralCard = {
  backgroundColor: '#fff9df',
  border: '1px solid #ead173',
  borderLeft: '5px solid #d6a900',
  borderRadius: '8px',
  margin: '0 0 30px',
  padding: '20px 22px',
}

const referralBadge = {
  backgroundColor: '#0b2948',
  borderRadius: '999px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '10px',
  fontWeight: '700',
  letterSpacing: '0.8px',
  margin: '0 0 14px',
  padding: '5px 9px',
}

const referralCaption = {
  color: '#687083',
  fontSize: '12px',
  fontWeight: '700',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}

const referralNameStyle = {
  color: '#172033',
  fontSize: '21px',
  fontWeight: '700',
  lineHeight: '29px',
  margin: 0,
}

const sectionHeading = {
  color: '#172033',
  fontSize: '18px',
  lineHeight: '26px',
  margin: '0 0 12px',
}

const detailsSection = {
  marginBottom: '4px',
}

const detailLabel = {
  color: '#687083',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  margin: '0 0 5px',
  textTransform: 'uppercase' as const,
}

const detailLine = {
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 9px',
}

const detailLineLabel = {
  color: '#687083',
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
  verticalAlign: 'top',
  width: '112px',
}

const detailLineValue = {
  color: '#172033',
  wordBreak: 'break-word' as const,
}

const recipientsSection = {
  borderTop: '1px solid #e5e7eb',
  marginTop: '8px',
  paddingTop: '22px',
}

const recipientRow = {
  color: '#172033',
  fontSize: '14px',
  lineHeight: '21px',
  margin: '4px 0',
}

const button = {
  backgroundColor: '#0b2948',
  borderRadius: '7px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '700',
  marginTop: '26px',
  padding: '13px 20px',
  textDecoration: 'none',
}

const divider = {
  borderColor: '#e5e7eb',
  margin: '30px 0 18px',
}

const footer = {
  color: '#7b8493',
  fontSize: '12px',
  lineHeight: '18px',
  margin: 0,
}

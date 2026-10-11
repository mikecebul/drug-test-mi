import { Body, Column, Container, Head, Hr, Html, Link, Preview, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { colors, rule, text } from '../utils/theme'

interface EmailLayoutProps {
  preview: string
  children: React.ReactNode
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <style>{`
          @media only screen and (max-width: 480px) {
            .email-card { padding: 20px !important; }
            .email-footer-column { display: block !important; width: 100% !important; padding: 0 !important; border: 0 !important; }
            .email-contact { margin-top: 16px !important; }
            .email-result-name, .email-result-status { display: block !important; width: 100% !important; }
            .email-result-status { padding-top: 4px !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f4f6f8',
          padding: '24px 8px',
          margin: '0',
          fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        }}
      >
        <Container
          className="email-card"
          style={{
            maxWidth: '640px',
            backgroundColor: '#ffffff',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '28px',
          }}
        >
          <Text style={{ ...text, color: colors.blue, fontWeight: 700 }}>MI Drug Test</Text>
          <Hr style={rule} />
          <Section>{children}</Section>
          <Hr style={rule} />
          <Row>
            <Column
              className="email-footer-column"
              style={{ width: '50%', verticalAlign: 'top', paddingRight: '16px' }}
            >
              <Text style={{ ...text, fontWeight: 600 }}>MI Drug Test</Text>
              <Text style={{ ...text, color: colors.muted }}>
                201 State St, Lower level
                <br />
                Charlevoix, MI 49720
              </Text>
            </Column>
            <Column
              className="email-footer-column email-contact"
              style={{
                width: '50%',
                verticalAlign: 'top',
                paddingLeft: '20px',
                borderLeft: `1px solid ${colors.border}`,
              }}
            >
              <Text style={{ ...text, color: colors.muted }}>Questions? Contact Mike</Text>
              <Text style={text}>
                <Link href="tel:+12313736341" style={{ color: colors.blue, textDecoration: 'none' }}>
                  (231) 373-6341
                </Link>
              </Text>
              <Text style={text}>
                <Link href="mailto:mike@midrugtest.com" style={{ color: colors.blue, textDecoration: 'none' }}>
                  mike@midrugtest.com
                </Link>
              </Text>
            </Column>
          </Row>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailLayout

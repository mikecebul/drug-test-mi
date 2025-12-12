import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import * as React from 'react'
import { main, container, footer } from '../utils/styles'

interface EmailLayoutProps {
  preview: string
  title?: string
  children: React.ReactNode
}

/**
 * EmailLayout provides consistent wrapper for all drug test emails
 * Includes company branding, header, and footer
 */
export function EmailLayout({ preview, title, children }: EmailLayoutProps) {
  const currentYear = new Date().getFullYear()

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          {title && (
            <Text
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#1f2937',
                margin: '0 0 24px 0',
              }}
            >
              {title}
            </Text>
          )}

          {/* Main Content */}
          <Section>{children}</Section>

          {/* Footer */}
          <Text style={footer}>
            MI Drug Test • 201 State St, Lower level, Charlevoix, MI 49720
            <br />
            {currentYear} © All rights reserved
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

EmailLayout.PreviewProps = {
  preview: 'Drug Test Notification',
  title: 'Drug Test Results',
  children: React.createElement('p', {}, 'Email content goes here'),
} as EmailLayoutProps

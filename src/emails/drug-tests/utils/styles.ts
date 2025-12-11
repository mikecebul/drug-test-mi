/**
 * Shared inline styles for email components
 * All styles use inline CSS for maximum email client compatibility (especially Outlook)
 */

import type { CSSProperties } from 'react'

/**
 * Main email body styles
 */
export const main: CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#24292e',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
}

/**
 * Container styles (max width wrapper)
 */
export const container: CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px',
}

/**
 * Section wrapper styles
 */
export const section: CSSProperties = {
  marginBottom: '24px',
}

/**
 * Header section styles
 */
export const header: CSSProperties = {
  backgroundColor: '#1e40af',
  padding: '24px',
  textAlign: 'center',
  borderRadius: '8px 8px 0 0',
}

/**
 * Header title styles
 */
export const headerTitle: CSSProperties = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 700,
  margin: '0',
}

/**
 * Content section with background
 */
export const contentSection: CSSProperties = {
  backgroundColor: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '24px',
}

/**
 * Text styles for paragraphs
 */
export const paragraph: CSSProperties = {
  margin: '0 0 16px 0',
  fontSize: '16px',
  lineHeight: '24px',
  color: '#374151',
}

/**
 * Detail row label styles
 */
export const label: CSSProperties = {
  fontWeight: 700,
  color: '#1f2937',
  fontSize: '14px',
  marginRight: '8px',
}

/**
 * Detail row value styles
 */
export const value: CSSProperties = {
  color: '#374151',
  fontSize: '14px',
}

/**
 * Button styles
 */
export const button: CSSProperties = {
  backgroundColor: '#1e40af',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '12px 24px',
  borderRadius: '6px',
  marginTop: '16px',
}

/**
 * Footer styles
 */
export const footer: CSSProperties = {
  color: '#6b7280',
  fontSize: '12px',
  textAlign: 'center',
  marginTop: '40px',
  paddingTop: '20px',
  borderTop: '1px solid #e5e7eb',
}

/**
 * Badge base styles
 */
export const badge: CSSProperties = {
  display: 'inline-block',
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 700,
  textAlign: 'center',
  marginBottom: '16px',
}

/**
 * Table styles for Outlook compatibility
 */
export const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

/**
 * Table row styles
 */
export const tableRow: CSSProperties = {
  borderBottom: '1px solid #e5e7eb',
}

/**
 * Table cell styles
 */
export const tableCell: CSSProperties = {
  padding: '12px',
  verticalAlign: 'top',
}

/**
 * Warning box styles
 */
export const warningBox: CSSProperties = {
  backgroundColor: '#fef3c7',
  border: '2px solid #f59e0b',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '16px',
}

/**
 * Success box styles
 */
export const successBox: CSSProperties = {
  backgroundColor: '#d1fae5',
  border: '2px solid #10b981',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '16px',
}

/**
 * Error box styles
 */
export const errorBox: CSSProperties = {
  backgroundColor: '#fee2e2',
  border: '2px solid #ef4444',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '16px',
}

/**
 * Divider styles
 */
export const divider: CSSProperties = {
  borderTop: '1px solid #e5e7eb',
  margin: '24px 0',
}

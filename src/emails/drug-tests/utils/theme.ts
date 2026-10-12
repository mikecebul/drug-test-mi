import type { CSSProperties } from 'react'

export const colors = {
  text: '#111827',
  muted: '#596273',
  border: '#d8dde5',
  blue: '#1647ed',
  red: '#d31322',
  green: '#16813b',
  amber: '#ad6800',
}

export const text: CSSProperties = {
  fontSize: '16px',
  lineHeight: '24px',
  color: colors.text,
  margin: '0',
}

export const rule: CSSProperties = {
  border: '0',
  borderTop: `1px solid ${colors.border}`,
  margin: '20px 0',
}

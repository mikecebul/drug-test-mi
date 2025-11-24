import { type ReactNode } from 'react'

export const Copyright = ({ children, year }: { children: ReactNode; year: number }) => {
  return (
    <span className="block text-center text-sm text-gray-500">
      © {year} {children}.{' '}
      <span className="inline-block">All rights reserved.</span>
    </span>
  )
}

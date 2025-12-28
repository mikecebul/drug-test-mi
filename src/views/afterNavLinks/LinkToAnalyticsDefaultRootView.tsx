'use client'

import Link from 'next/link'
import React from 'react'

const LinkToAnalyticsDefaultRootView: React.FC = () => {
  return (
    <Link
      href="/admin/analytics"
      className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
      <span>View Analytics</span>
    </Link>
  )
}

export default LinkToAnalyticsDefaultRootView

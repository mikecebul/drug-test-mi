'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'

export default function DrugTestTrackerLink() {
  const { user } = useAuth()

  // Only show to admins
  if (!user || user.collection !== 'admins') {
    return null
  }

  return (
    <Link
      href="/admin/drug-test-tracker"
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
        <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
        <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
      </svg>
      <span>Drug Test Tracker</span>
    </Link>
  )
}

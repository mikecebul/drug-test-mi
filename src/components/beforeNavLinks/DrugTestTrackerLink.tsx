'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'

export default function DrugTestTrackerLink() {
  const { user } = useAuth()

  // Only show to admins
  if (!user || user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pt-2 pb-3">
      <Button size="lg" asChild variant="secondary" className="w-full min-w-2xs gap-2">
        <Link href="/admin/drug-test-tracker">
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
          Drug Test Tracker
        </Link>
      </Button>
    </ShadcnWrapper>
  )
}

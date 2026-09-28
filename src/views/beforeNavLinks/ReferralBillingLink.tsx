'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { CircleDollarSign } from 'lucide-react'

export default function ReferralBillingLink() {
  const { user } = useAuth()
  if (!user || user.collection !== 'admins') return null
  return (
    <ShadcnWrapper className="w-full py-1.5">
      <Button
        render={<Link href="/admin/referral-billing" />}
        nativeButton={false}
        variant="secondary"
        className="w-full min-w-0 justify-start"
      >
        <CircleDollarSign data-icon="inline-start" />
        Referral Billing
      </Button>
    </ShadcnWrapper>
  )
}

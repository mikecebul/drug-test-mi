'use client'

import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'

export default function CollectPaymentLink() {
  const { user } = useAuth()
  if (user?.collection !== 'admins') return null
  return (
    <ShadcnWrapper className="staff-interface w-full py-1.5">
      <Button
        render={<Link href="/admin/collect-payment" />}
        nativeButton={false}
        variant="secondary"
        className="w-full min-w-0 justify-start"
      >
        <WalletCards data-icon="inline-start" />
        Collect Payment
      </Button>
    </ShadcnWrapper>
  )
}

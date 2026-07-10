'use client'

import React from 'react'
import Link from 'next/link'
import { CalendarCheck } from 'lucide-react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'

export default function DrugTestCollectorLink() {
  return (
    <ShadcnWrapper className="py-1.5">
      <Button
        size="lg"
        render={<Link href="/admin/drug-test-upload" />}
        nativeButton={false}
        className="w-full min-w-2xs gap-2"
      >
        <CalendarCheck className="size-[18px]" />
        Collect Test
      </Button>
    </ShadcnWrapper>
  )
}

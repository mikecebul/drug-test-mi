'use client'

import React from 'react'
import Link from 'next/link'
import { CalendarCheck } from 'lucide-react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'

export default function DrugTestCollectorLink() {
  return (
    <ShadcnWrapper className="w-full py-1.5">
      <Button
        render={<Link href="/admin/drug-test-upload" />}
        nativeButton={false}
        className="w-full min-w-0 justify-start"
      >
        <CalendarCheck data-icon="inline-start" />
        Collect Test
      </Button>
    </ShadcnWrapper>
  )
}

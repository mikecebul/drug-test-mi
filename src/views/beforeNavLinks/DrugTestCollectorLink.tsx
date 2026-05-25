'use client'

import React from 'react'
import Link from 'next/link'
import { CalendarCheck } from 'lucide-react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'

export default function DrugTestCollectorLink() {
  return (
    <ShadcnWrapper className="pt-2 pb-3">
      <Button size="xl" asChild className="w-full min-w-2xs gap-2">
        <Link href="/admin/drug-test-upload?workflow=guided&step=schedule">
          <CalendarCheck className="size-[18px]" />
          Collect Test
        </Link>
      </Button>
    </ShadcnWrapper>
  )
}

'use client'

import React, { Suspense } from 'react'
import { TechnicianSelection } from '@/components/technician-selection'
import { TechnicianSelectionSkeleton } from '@/components/TechnicianSelectionSkeleton'
import type { Technician } from '@/payload-types'
import { useRouter, useSearchParams } from 'next/navigation'

interface SchedulePageClientProps {
  title?: string
  technicians: Technician[]
}

function SchedulePageContent({ technicians }: SchedulePageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTechnicianSelect = (technician: Technician) => {
    const technicianSlug = technician.name.toLowerCase().replace(/\s+/g, '-')

    // Build the URL with current filters and referrer info
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', 'schedule')

    const queryString = params.toString()
    const url = `/technicians/${technicianSlug}${queryString ? `?${queryString}` : ''}`

    router.push(url)
  }

  return (
    <TechnicianSelection
      onTechnicianSelect={handleTechnicianSelect}
      technicians={technicians}
    />
  )
}

export const SchedulePageClient = ({ title, technicians }: SchedulePageClientProps) => {
  return (
    <div className="bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <h1 className="text-foreground mb-2 text-2xl font-bold sm:mb-3 sm:text-3xl lg:text-4xl">
            {title || 'Schedule Your Drug Test'}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
            Select your preferred technician and schedule your appointment.
          </p>
        </div>

        <Suspense fallback={<TechnicianSelectionSkeleton />}>
          <SchedulePageContent technicians={technicians} />
        </Suspense>
      </div>
    </div>
  )
}

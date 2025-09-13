"use client"

import { TechnicianSelection } from "@/components/technician-selection"
import type { Technician } from "@/payload-types"
import { useRouter } from "next/navigation"

interface SchedulePageClientProps {
  title?: string
  technicians: Technician[]
}

export const SchedulePageClient = ({ title, technicians }: SchedulePageClientProps) => {
  const router = useRouter()

  const handleTechnicianSelect = (technician: Technician) => {
    const technicianSlug = technician.name.toLowerCase().replace(/\s+/g, '-')
    router.push(`/technicians/${technicianSlug}`)
  }

  return (
    <div className="bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-3">
            {title || "Schedule Your Drug Test"}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
            Select your preferred technician and schedule your appointment.
          </p>
        </div>

        <TechnicianSelection onTechnicianSelect={handleTechnicianSelect} technicians={technicians} />
      </div>
    </div>
  )
}
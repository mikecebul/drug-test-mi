"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react"
import { CalEmbed } from "@/components/cal-embed"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import type { Technician } from "@/payload-types"
import { useClientDashboard } from "@/hooks/useClientDashboard"

interface DashboardTechnicianDetailProps {
  technician: Technician
}

function getTechnicianAvailabilityText(technician: Technician): string {
  const times: string[] = []
  if (technician.availability?.mornings) times.push("mornings")
  if (technician.availability?.evenings) times.push("evenings")

  const days: string[] = []
  if (technician.availability?.weekdays) days.push("weekdays")
  if (technician.availability?.weekends) days.push("weekends")

  const timeText = times.length > 0 ? times.join(" & ") : "flexible hours"
  const dayText = days.length > 0 ? days.join(" & ") : "any day"

  return `Available ${timeText} on ${dayText}`
}

export function DashboardTechnicianDetail({ technician }: DashboardTechnicianDetailProps) {
  const searchParams = useSearchParams()
  const { data: dashboardData } = useClientDashboard()

  const backNavigation = useMemo(() => {
    const from = searchParams.get('from')

    if (from === 'schedule') {
      // Reconstruct the schedule URL with preserved filters
      const params = new URLSearchParams(searchParams.toString())
      params.delete('from') // Remove the 'from' parameter

      const scheduleUrl = `/dashboard/schedule${params.toString() ? `?${params.toString()}` : ''}`

      return {
        href: scheduleUrl,
        label: 'Back to Schedule & Filters'
      }
    }

    // Default to dashboard
    return {
      href: '/dashboard',
      label: 'Back to Dashboard'
    }
  }, [searchParams])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href={backNavigation.href}>
              <Button
                variant="outline"
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backNavigation.label}
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Schedule with {technician.name}</h1>
            <p className="text-muted-foreground">
              Book your drug test appointment with {technician.name.split(' ')[0]}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 space-y-6">
        {/* Technician Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <Avatar className="h-20 w-20 lg:h-24 lg:w-24 mx-auto sm:mx-0">
                <AvatarImage
                  src={typeof technician.photo === 'object' && technician.photo?.url || "/placeholder.svg"}
                  alt={technician.name}
                />
                <AvatarFallback className="text-lg lg:text-xl">
                  {technician.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                  <h2 className="text-xl lg:text-2xl font-semibold">{technician.name}</h2>
                  <Badge variant="secondary" className="capitalize w-fit mx-auto sm:mx-0">
                    {technician.gender}
                  </Badge>
                </div>

                <p className="text-muted-foreground text-sm lg:text-base mb-4 max-w-md">{technician.bio}</p>

                <div className="flex flex-col sm:flex-row gap-4 text-sm lg:text-base text-muted-foreground">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
                    <span>{getTechnicianAvailabilityText(technician)}</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <MapPin className="h-4 w-4 lg:h-5 lg:w-5" />
                    <span className="capitalize">{technician.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Book Your Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CalEmbed
              calUsername={technician.calComUsername}
              testerName={technician.name}
              userData={dashboardData?.user ? {
                name: dashboardData.user.name,
                email: dashboardData.user.email
              } : undefined}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
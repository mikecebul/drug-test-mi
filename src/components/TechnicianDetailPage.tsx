'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react'
import { CalPopupButton } from '@/components/cal-popup-button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import type { Technician } from '@/payload-types'

interface TechnicianDetailPageProps {
  technician: Technician
}

function getTechnicianAvailabilityText(technician: Technician): string {
  const times: string[] = []
  if (technician.availability?.mornings) times.push('mornings')
  if (technician.availability?.evenings) times.push('evenings')

  const days: string[] = []
  if (technician.availability?.weekdays) days.push('weekdays')
  if (technician.availability?.weekends) days.push('weekends')

  const timeText = times.length > 0 ? times.join(' & ') : 'flexible hours'
  const dayText = days.length > 0 ? days.join(' & ') : 'any day'

  return `Available ${timeText} on ${dayText}`
}

export function TechnicianDetailPage({ technician }: TechnicianDetailPageProps) {
  const searchParams = useSearchParams()

  const backNavigation = useMemo(() => {
    const from = searchParams.get('from')

    if (from === 'schedule') {
      // Reconstruct the schedule URL with preserved filters
      const params = new URLSearchParams(searchParams.toString())
      params.delete('from') // Remove the 'from' parameter

      const scheduleUrl = `/schedule${params.toString() ? `?${params.toString()}` : ''}`

      return {
        href: scheduleUrl,
        label: 'Back to Schedule & Filters',
      }
    }

    // Default to technicians directory
    return {
      href: '/technicians',
      label: 'Back to All Technicians',
    }
  }, [searchParams])

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <Link href={backNavigation.href}>
            <Button
              variant="outline"
              className="bg-background hover:bg-muted mb-4 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backNavigation.label}
            </Button>
          </Link>

          <h1 className="text-foreground mb-2 text-2xl font-bold sm:mb-3 sm:text-3xl lg:text-4xl">
            Schedule with {technician.name}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
            Book your drug test appointment with {technician.name.split(' ')[0]}.
          </p>
        </div>

        <div className="space-y-6 lg:space-y-8">
          <Card className="border-2">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
                <Avatar className="mx-auto h-20 w-20 sm:mx-0 lg:h-24 lg:w-24">
                  <AvatarImage
                    src={
                      (typeof technician.photo === 'object' && technician.photo?.url) ||
                      '/placeholder.svg'
                    }
                    alt={technician.name}
                  />
                  <AvatarFallback className="text-lg lg:text-xl">
                    {technician.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 text-center sm:text-left">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <h2 className="text-xl font-semibold lg:text-2xl">{technician.name}</h2>
                    <Badge variant="secondary" className="mx-auto w-fit capitalize sm:mx-0">
                      {technician.gender}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground mb-4 max-w-md text-sm lg:text-base">
                    {technician.bio}
                  </p>

                  <div className="text-muted-foreground flex flex-col gap-4 text-sm sm:flex-row lg:text-base">
                    <div className="flex items-center justify-center gap-2 sm:justify-start">
                      <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
                      <span>{getTechnicianAvailabilityText(technician)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 sm:justify-start">
                      <MapPin className="h-4 w-4 lg:h-5 lg:w-5" />
                      <span className="capitalize">{technician.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-4 lg:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                <Calendar className="h-5 w-5 lg:h-6 lg:w-6" />
                Book Your Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Click the button below to open the booking calendar and schedule your appointment
                  with {technician.name.split(' ')[0]}.
                </p>
                <CalPopupButton className="w-full" variant="default">
                  <Calendar className="mr-2 h-4 w-4" />
                  Open Booking Calendar
                </CalPopupButton>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react"
import { CalEmbed } from "@/components/cal-embed"
import Link from "next/link"
import type { Technician } from "@/payload-types"

interface TechnicianDetailPageProps {
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

export function TechnicianDetailPage({ technician }: TechnicianDetailPageProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <Link href="/technicians">
            <Button
              variant="outline"
              className="bg-background hover:bg-muted transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to All Technicians
            </Button>
          </Link>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-3">
            Schedule with {technician.name}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
            Book your drug test appointment with {technician.name.split(' ')[0]}.
          </p>
        </div>

        <div className="space-y-6 lg:space-y-8">
          <Card className="border-2">
            <CardContent className="p-6 lg:p-8">
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

          <Card className="border-2">
            <CardHeader className="pb-4 lg:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                <Calendar className="h-5 w-5 lg:h-6 lg:w-6" />
                Book Your Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <CalEmbed calUsername={technician.calComUsername} testerName={technician.name} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
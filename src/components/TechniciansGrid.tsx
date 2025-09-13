"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, MapPin } from "lucide-react"
import Link from "next/link"
import type { Technician } from "@/payload-types"

interface TechniciansGridProps {
  technicians: Technician[]
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

export function TechniciansGrid({ technicians }: TechniciansGridProps) {
  if (technicians.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          No technicians are currently available. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {technicians.map((technician) => {
          const technicianSlug = technician.name.toLowerCase().replace(/\s+/g, '-')
          
          return (
            <Card key={technician.id} className="group hover:shadow-lg transition-all duration-300 hover:border-primary/20">
              <CardContent className="p-6 text-center">
                <div className="space-y-4">
                  <Avatar className="h-24 w-24 mx-auto ring-2 ring-background group-hover:ring-primary/20 transition-all">
                    <AvatarImage 
                      src={typeof technician.photo === 'object' && technician.photo?.url || "/placeholder.svg"} 
                      alt={technician.name} 
                    />
                    <AvatarFallback className="text-xl">
                      {technician.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-xl font-semibold">{technician.name}</h3>
                      <Badge variant="secondary" className="capitalize">
                        {technician.gender}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground text-sm leading-relaxed min-h-[3rem]">
                      {technician.bio}
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{getTechnicianAvailabilityText(technician)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="capitalize">{technician.location}</span>
                    </div>
                  </div>

                  <Link href={`/technicians/${technicianSlug}?from=technicians`} className="block">
                    <Button className="w-full mt-4 group-hover:bg-primary/90 transition-colors">
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule with {technician.name.split(" ")[0]}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center pt-8 border-t">
        <p className="text-muted-foreground mb-4">
          Need help choosing? Use our scheduling tool with preference filters.
        </p>
        <Link href="/schedule">
          <Button variant="outline" size="lg">
            Advanced Scheduling Options
          </Button>
        </Link>
      </div>
    </div>
  )
}
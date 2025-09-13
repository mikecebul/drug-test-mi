"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, User, Calendar, Filter, MapPin } from "lucide-react"
import type { Technician } from "@/payload-types"

type GenderPreference = "any" | "male" | "female"
type TimePreference = "any" | "morning" | "evening"
type DayPreference = "any" | "weekday" | "weekend"

interface TechnicianSelectionProps {
  onTechnicianSelect: (technician: Technician) => void
  technicians: Technician[]
}

function getTechnicianAvailabilityText(technician: Technician): string {
  const times = []
  if (technician.availability?.mornings) times.push("mornings")
  if (technician.availability?.evenings) times.push("evenings")
  
  const days = []
  if (technician.availability?.weekdays) days.push("weekdays")
  if (technician.availability?.weekends) days.push("weekends")
  
  const timeText = times.length > 0 ? times.join(" & ") : "flexible hours"
  const dayText = days.length > 0 ? days.join(" & ") : "any day"
  
  return `Available ${timeText} on ${dayText}`
}

export function TechnicianSelection({ onTechnicianSelect, technicians }: TechnicianSelectionProps) {
  const [genderPreference, setGenderPreference] = useState<GenderPreference>("any")
  const [timePreference, setTimePreference] = useState<TimePreference>("any")
  const [dayPreference, setDayPreference] = useState<DayPreference>("any")
  const [locationPreference, setLocationPreference] = useState<string>("any")

  const availableTechnicians = useMemo(() => {
    return technicians.filter((technician) => {
      // Filter by gender
      const genderMatch = genderPreference === "any" || technician.gender === genderPreference
      
      // Filter by time
      const timeMatch = timePreference === "any" || 
        (timePreference === "morning" && technician.availability?.mornings) ||
        (timePreference === "evening" && technician.availability?.evenings)
      
      // Filter by day
      const dayMatch = dayPreference === "any" ||
        (dayPreference === "weekday" && technician.availability?.weekdays) ||
        (dayPreference === "weekend" && technician.availability?.weekends)
      
      // Filter by location
      const locationMatch = locationPreference === "any" || technician.location === locationPreference
      
      return genderMatch && timeMatch && dayMatch && locationMatch
    })
  }, [technicians, genderPreference, timePreference, dayPreference, locationPreference])

  // Get unique locations from technicians
  const availableLocations = useMemo(() => {
    const locations = [...new Set(technicians.map(t => t.location))]
    return locations
  }, [technicians])

  const MobileFilters = () => (
    <Card className="md:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filter Technicians
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gender Preference</label>
          <Select value={genderPreference} onValueChange={(value: GenderPreference) => setGenderPreference(value)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Gender</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Preference</label>
          <Select value={timePreference} onValueChange={(value: TimePreference) => setTimePreference(value)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Time</SelectItem>
              <SelectItem value="morning">Morning (AM)</SelectItem>
              <SelectItem value="evening">Evening (PM)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Day Preference</label>
          <Select value={dayPreference} onValueChange={(value: DayPreference) => setDayPreference(value)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Day</SelectItem>
              <SelectItem value="weekday">Weekdays</SelectItem>
              <SelectItem value="weekend">Weekends</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
          <Select value={locationPreference} onValueChange={setLocationPreference}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Location</SelectItem>
              {availableLocations.map((location) => (
                <SelectItem key={location} value={location} className="capitalize">
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )

  const DesktopFilters = () => (
    <Card className="hidden md:block sticky top-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5" />
          Filter Technicians
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gender Preference</label>
          <div className="space-y-1.5">
            <Button
              variant={genderPreference === "any" ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderPreference("any")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Any Gender
            </Button>
            <Button
              variant={genderPreference === "male" ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderPreference("male")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Male Technician
            </Button>
            <Button
              variant={genderPreference === "female" ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderPreference("female")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Female Technician
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Preference</label>
          <div className="space-y-1.5">
            <Button
              variant={timePreference === "any" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimePreference("any")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Any Time
            </Button>
            <Button
              variant={timePreference === "morning" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimePreference("morning")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Morning (AM)
            </Button>
            <Button
              variant={timePreference === "evening" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimePreference("evening")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Evening (PM)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Day Preference</label>
          <div className="space-y-1.5">
            <Button
              variant={dayPreference === "any" ? "default" : "outline"}
              size="sm"
              onClick={() => setDayPreference("any")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Any Day
            </Button>
            <Button
              variant={dayPreference === "weekday" ? "default" : "outline"}
              size="sm"
              onClick={() => setDayPreference("weekday")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Weekdays Only
            </Button>
            <Button
              variant={dayPreference === "weekend" ? "default" : "outline"}
              size="sm"
              onClick={() => setDayPreference("weekend")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              Weekends Only
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
          <div className="space-y-1.5">
            <Button
              variant={locationPreference === "any" ? "default" : "outline"}
              size="sm"
              onClick={() => setLocationPreference("any")}
              className="w-full justify-start h-8 text-sm font-medium"
            >
              <MapPin className="h-3 w-3 mr-2" />
              Any Location
            </Button>
            {availableLocations.map((location) => (
              <Button
                key={location}
                variant={locationPreference === location ? "default" : "outline"}
                size="sm"
                onClick={() => setLocationPreference(location)}
                className="w-full justify-start h-8 text-sm font-medium capitalize"
              >
                <MapPin className="h-3 w-3 mr-2" />
                {location}
              </Button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground text-sm">{availableTechnicians.length}</span> technician
            {availableTechnicians.length !== 1 ? "s" : ""} available
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4 lg:space-y-6">
      <MobileFilters />

      <div className="md:grid md:grid-cols-4 md:gap-6 lg:gap-8">
        <div className="md:col-span-1">
          <DesktopFilters />
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold md:hidden">Available Technicians ({availableTechnicians.length})</h3>
            <h3 className="text-xl font-semibold hidden md:block">Available Technicians</h3>
          </div>

          {availableTechnicians.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-muted-foreground">
                  No technicians available for your selected preferences. Please try different filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:gap-4">
              {availableTechnicians.map((technician) => (
                <Card key={technician.id} className="hover:shadow-lg transition-all duration-200 hover:border-primary/20">
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex flex-col sm:flex-row gap-4 lg:gap-6">
                      <div className="flex items-start gap-3 lg:gap-4 flex-1">
                        <Avatar className="h-14 w-14 lg:h-16 lg:w-16">
                          <AvatarImage 
                            src={typeof technician.photo === 'object' && technician.photo?.url || "/placeholder.svg"} 
                            alt={technician.name} 
                          />
                          <AvatarFallback className="text-sm lg:text-base">
                            {technician.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                            <h4 className="text-base lg:text-lg font-semibold">{technician.name}</h4>
                            <Badge variant="secondary" className="capitalize w-fit text-xs">
                              {technician.gender}
                            </Badge>
                          </div>

                          <p className="text-muted-foreground text-xs lg:text-sm mb-2 lg:mb-3 line-clamp-2">
                            {technician.bio}
                          </p>

                          <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 lg:h-4 lg:w-4" />
                            <span>{getTechnicianAvailabilityText(technician)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center sm:items-start">
                        <Button
                          onClick={() => onTechnicianSelect(technician)}
                          className="w-full sm:w-auto text-sm lg:text-base h-9 lg:h-10"
                        >
                          <Calendar className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                          Schedule with {technician.name.split(" ")[0]}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
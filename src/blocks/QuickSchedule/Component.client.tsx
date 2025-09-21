'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Clock, User } from 'lucide-react'
import type { Technician } from '@/payload-types'
import Link from 'next/link'

type GenderPreference = 'any' | 'male' | 'female'
type TimePreference = 'any' | 'morning' | 'evening'
type DayPreference = 'any' | 'weekday' | 'weekend'

interface QuickScheduleClientProps {
  technicians: Technician[]
}

export function QuickScheduleClient({ technicians }: QuickScheduleClientProps) {
  const [genderPreference, setGenderPreference] = useState<GenderPreference>('any')
  const [timePreference, setTimePreference] = useState<TimePreference>('any')
  const [dayPreference, setDayPreference] = useState<DayPreference>('any')

  const availableTechnicians = useMemo(() => {
    return technicians.filter((technician) => {
      // Filter by gender
      const genderMatch = genderPreference === 'any' || technician.gender === genderPreference

      // Filter by time
      const timeMatch =
        timePreference === 'any' ||
        (timePreference === 'morning' && technician.availability?.mornings) ||
        (timePreference === 'evening' && technician.availability?.evenings)

      // Filter by day
      const dayMatch =
        dayPreference === 'any' ||
        (dayPreference === 'weekday' && technician.availability?.weekdays) ||
        (dayPreference === 'weekend' && technician.availability?.weekends)

      return genderMatch && timeMatch && dayMatch
    })
  }, [technicians, genderPreference, timePreference, dayPreference])

  return (
    <section>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center">
          <h2 className="text-foreground mb-2 text-2xl font-bold">Quick Schedule</h2>
          <p className="text-muted-foreground">Find and book with an available tester.</p>
        </div>

        <Card className="mx-auto max-w-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Find Available Testers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-3 gap-4">
              {/* Gender Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-medium">
                  <User className="h-3 w-3" />
                  Gender
                </label>
                <RadioGroup
                  value={genderPreference}
                  onValueChange={(value: GenderPreference) => setGenderPreference(value)}
                  className="space-y-1"
                >
                  {[
                    { value: 'any' as const, label: 'Any' },
                    { value: 'male' as const, label: 'Male' },
                    { value: 'female' as const, label: 'Female' },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={option.value}
                        id={`gender-${option.value}`}
                        className="h-3 w-3"
                      />
                      <label
                        htmlFor={`gender-${option.value}`}
                        className="text-xs leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Time Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-medium">
                  <Clock className="h-3 w-3" />
                  Time
                </label>
                <RadioGroup
                  value={timePreference}
                  onValueChange={(value: TimePreference) => setTimePreference(value)}
                  className="space-y-1"
                >
                  {[
                    { value: 'any' as const, label: 'Any' },
                    { value: 'morning' as const, label: 'AM' },
                    { value: 'evening' as const, label: 'PM' },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={option.value}
                        id={`time-${option.value}`}
                        className="h-3 w-3"
                      />
                      <label
                        htmlFor={`time-${option.value}`}
                        className="text-xs leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Day Type Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-medium">
                  <Calendar className="h-3 w-3" />
                  Days
                </label>
                <RadioGroup
                  value={dayPreference}
                  onValueChange={(value: DayPreference) => setDayPreference(value)}
                  className="space-y-1"
                >
                  {[
                    { value: 'any' as const, label: 'Any' },
                    { value: 'weekday' as const, label: 'Weekdays' },
                    { value: 'weekend' as const, label: 'Weekends' },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={option.value}
                        id={`day-${option.value}`}
                        className="h-3 w-3"
                      />
                      <label
                        htmlFor={`day-${option.value}`}
                        className="text-xs leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            {availableTechnicians.length > 0 && (
              <div className="mb-6">
                <h3 className="text-muted-foreground mb-3 text-sm font-medium">
                  Available Testers ({availableTechnicians.length})
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {availableTechnicians.map((technician) => (
                    <div key={technician.id} className="flex flex-col items-center gap-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={
                            (typeof technician.photo === 'object' && technician.photo?.url) ||
                            '/placeholder.svg'
                          }
                          alt={technician.name}
                        />
                        <AvatarFallback className="text-xs">
                          {technician.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-center text-xs font-medium">
                        {technician.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="text-muted-foreground text-xs">
                {availableTechnicians.length === 0 ? (
                  <p>No testers available for your preferences.</p>
                ) : (
                  <p>
                    {availableTechnicians.length} tester
                    {availableTechnicians.length !== 1 ? 's' : ''} available
                  </p>
                )}
              </div>

              {availableTechnicians.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <p className="text-muted-foreground text-center text-xs">
                    Registration required to schedule
                  </p>
                  <Button asChild>
                    <Link href="/schedule">Schedule Now</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

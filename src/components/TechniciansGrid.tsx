'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Technician } from '@/payload-types'

interface TechniciansGridProps {
  technicians: Technician[]
}

export function TechniciansGrid({ technicians }: TechniciansGridProps) {
  if (technicians.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground text-lg">
          No technicians are currently available. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
      {technicians.map((technician) => {
        return (
          <Card
            key={technician.id}
            className="group hover:border-primary/20 transition-all duration-300 hover:shadow-lg"
          >
            <CardContent className="p-6 text-center">
              <div className="space-y-4">
                <Avatar className="ring-background group-hover:ring-primary/20 mx-auto h-24 w-24 ring-2 transition-all">
                  <AvatarImage
                    src={
                      (typeof technician.photo === 'object' && technician.photo?.url) ||
                      '/placeholder.svg'
                    }
                    alt={technician.name}
                  />
                  <AvatarFallback className="text-xl">
                    {technician.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-xl font-semibold">{technician.name}</h3>
                    <Badge variant="secondary" className="capitalize">
                      {technician.gender}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground min-h-[3rem] text-sm leading-relaxed">
                    {technician.bio}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

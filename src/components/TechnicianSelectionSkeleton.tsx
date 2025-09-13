import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Filter, User } from "lucide-react"

export function TechnicianSelectionSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Mobile Filters Skeleton */}
      <Card className="md:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filter Technicians
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="md:grid md:grid-cols-4 md:gap-6 lg:gap-8">
        {/* Desktop Filters Skeleton */}
        <div className="md:col-span-1">
          <Card className="hidden md:block sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Filter Technicians
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <div className="space-y-1.5">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className="h-8 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Technician Cards Skeleton */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40 md:hidden" />
            <Skeleton className="h-7 w-48 hidden md:block" />
          </div>

          <div className="grid gap-3 lg:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex flex-col sm:flex-row gap-4 lg:gap-6">
                    <div className="flex items-start gap-3 lg:gap-4 flex-1">
                      {/* Avatar Skeleton */}
                      <Skeleton className="h-14 w-14 lg:h-16 lg:w-16 rounded-full" />

                      <div className="flex-1 min-w-0">
                        {/* Name and Badge */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                          <Skeleton className="h-5 w-32 lg:h-6 lg:w-36" />
                          <Skeleton className="h-5 w-12 rounded-full" />
                        </div>

                        {/* Bio */}
                        <div className="space-y-1 mb-2 lg:mb-3">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>

                        {/* Availability */}
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-3 lg:h-4 lg:w-4" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </div>

                    {/* Button */}
                    <div className="flex items-center sm:items-start">
                      <Skeleton className="h-9 w-full sm:w-auto sm:h-10 lg:w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
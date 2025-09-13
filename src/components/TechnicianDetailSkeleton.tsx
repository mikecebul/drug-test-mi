import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Calendar } from "lucide-react"

export function TechnicianDetailSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="mb-6 sm:mb-8 lg:mb-10">
          {/* Back Button Skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Title Skeleton */}
          <Skeleton className="h-8 sm:h-10 lg:h-12 w-64 sm:w-80 lg:w-96 mb-2 sm:mb-3" />
          <Skeleton className="h-4 sm:h-5 w-48 sm:w-64" />
        </div>

        <div className="space-y-6 lg:space-y-8">
          {/* Technician Info Card Skeleton */}
          <Card className="border-2">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                {/* Avatar Skeleton */}
                <Skeleton className="h-20 w-20 lg:h-24 lg:w-24 rounded-full mx-auto sm:mx-0" />

                <div className="flex-1 text-center sm:text-left">
                  {/* Name and Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                    <Skeleton className="h-6 lg:h-7 w-48 lg:w-56 mx-auto sm:mx-0" />
                    <Skeleton className="h-5 w-16 rounded-full mx-auto sm:mx-0" />
                  </div>

                  {/* Bio */}
                  <div className="space-y-2 mb-4">
                    <Skeleton className="h-4 lg:h-5 w-full max-w-md mx-auto sm:mx-0" />
                    <Skeleton className="h-4 lg:h-5 w-3/4 max-w-md mx-auto sm:mx-0" />
                  </div>

                  {/* Availability and Location */}
                  <div className="flex flex-col sm:flex-row gap-4 text-sm lg:text-base">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Skeleton className="h-4 w-4 lg:h-5 lg:w-5" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Skeleton className="h-4 w-4 lg:h-5 lg:w-5" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Card Skeleton */}
          <Card className="border-2">
            <CardHeader className="pb-4 lg:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                <Calendar className="h-5 w-5 lg:h-6 lg:w-6" />
                Book Your Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Cal.com Embed Skeleton */}
              <div className="w-full border rounded-lg bg-muted/50 p-8">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48 mx-auto" />
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-8 rounded" />
                    ))}
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
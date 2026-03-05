import React from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function WizardTypeSelectorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border">
            <CardHeader>
              <div className="flex items-start gap-4">
                {/* Icon skeleton */}
                <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                {/* Text content skeleton */}
                <div className="flex-1 space-y-2">
                  {/* Title skeleton */}
                  <Skeleton className="h-6 w-3/4" />
                  {/* Description skeleton - 2 lines */}
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

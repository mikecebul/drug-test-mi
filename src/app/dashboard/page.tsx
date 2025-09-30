import { DashboardClient } from './DashboardClient'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/get-query-client'
import { Suspense } from 'react'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'

export default async function DashboardPage() {
  const queryClient = getQueryClient()

  // Use the SAME query function that the client will use
  // This ensures consistency and prevents hydration mismatches
  const { refetchClientDashboard } = await import('@/hooks/useClientDashboard')

  await queryClient.prefetchQuery({
    queryKey: ['clientDashboard'],
    queryFn: refetchClientDashboard,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient />
      </Suspense>
    </HydrationBoundary>
  )
}

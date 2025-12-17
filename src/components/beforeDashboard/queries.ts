'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboardStats, type DashboardStats } from './actions'

export function useDashboardStatsQuery() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    staleTime: 30 * 1000, // 30 seconds - stats should be relatively fresh
    refetchInterval: 60 * 1000, // Auto-refetch every minute
  })
}

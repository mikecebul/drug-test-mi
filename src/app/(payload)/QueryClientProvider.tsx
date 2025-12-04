'use client'

import React from 'react'
import { QueryClient, QueryClientProvider as TanStackQueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Create a single QueryClient instance that will be shared across all admin views
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus in admin panel (less distracting)
      refetchOnWindowFocus: false,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Don't show errors in console by default (we handle them in UI)
      throwOnError: false,
    },
  },
})

interface QueryClientProviderProps {
  children: React.ReactNode
}

/**
 * TanStack Query provider for PayloadCMS admin panel
 * Provides a single QueryClient instance shared across all admin views
 */
export function QueryClientProvider({ children }: QueryClientProviderProps) {
  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </TanStackQueryClientProvider>
  )
}

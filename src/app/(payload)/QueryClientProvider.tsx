'use client'

import React from 'react'
import { QueryClient, QueryClientProvider as TanStackQueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

function makeQueryClient() {
  return new QueryClient({
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
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

interface QueryClientProviderProps {
  children: React.ReactNode
}

/**
 * TanStack Query provider for PayloadCMS admin panel
 * Uses factory pattern to prevent data leakage between requests on the server
 */
export function QueryClientProvider({ children }: QueryClientProviderProps) {
  const queryClient = getQueryClient()

  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development */}
      {false && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />}
    </TanStackQueryClientProvider>
  )
}

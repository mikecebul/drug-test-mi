'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'
import {
  type Mutation,
  MutationCache,
  type Query,
  QueryCache,
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { isVersionSkewError, toError } from '@/lib/errors/versionSkew'

function captureQueryError(error: unknown, query: Query<unknown, unknown, unknown, readonly unknown[]>) {
  const normalizedError = toError(error)
  Sentry.withScope((scope) => {
    scope.setTag('error_source', 'react-query')
    scope.setTag('error_kind', 'query')
    scope.setContext('react_query', {
      queryHash: query.queryHash,
      queryKey: query.queryKey,
      fetchFailureCount: query.state.fetchFailureCount,
      status: query.state.status,
    })
    Sentry.captureException(normalizedError)
  })
}

function captureMutationError(error: unknown, mutation: Mutation<unknown, unknown, unknown, unknown>) {
  const normalizedError = toError(error)
  Sentry.withScope((scope) => {
    scope.setTag('error_source', 'react-query')
    scope.setTag('error_kind', 'mutation')
    scope.setContext('react_query', {
      mutationKey: mutation.options.mutationKey,
      status: mutation.state.status,
      failureCount: mutation.state.failureCount,
    })
    Sentry.captureException(normalizedError)
  })
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        captureQueryError(error, query)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        captureMutationError(error, mutation)
      },
    }),
    defaultOptions: {
      queries: {
        // Don't refetch on window focus in admin panel (less distracting)
        refetchOnWindowFocus: false,
        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Retry failed requests once for normal failures, never for deploy/version skew.
        retry: (failureCount, error) => {
          if (isVersionSkewError(error)) {
            return false
          }
          return failureCount < 1
        },
        // Only bubble version skew errors to boundaries; keep normal API errors inline.
        throwOnError: (error) => isVersionSkewError(error),
      },
      mutations: {
        // Keep disabled by default to avoid duplicate side effects on non-idempotent actions.
        retry: false,
        throwOnError: (error) => isVersionSkewError(error),
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

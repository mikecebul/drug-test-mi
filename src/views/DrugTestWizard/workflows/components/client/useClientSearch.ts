'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ClientSearchInput } from '@/collections/Clients/search/types'
import { CLIENT_SEARCH_DEBOUNCE_MS, CLIENT_SEARCH_MIN_CHARS, searchClients } from './clientSearch'

function hasStructuredSearch(input: ClientSearchInput) {
  return Boolean(input.name?.trim() || input.email?.trim() || input.phone?.trim() || input.dob?.trim())
}

export function useClientSearch(input: ClientSearchInput, options: { enabled?: boolean; debounceMs?: number } = {}) {
  const enabled = options.enabled ?? true
  const debounceMs = options.debounceMs ?? CLIENT_SEARCH_DEBOUNCE_MS
  const inputKey = JSON.stringify(input)
  const [delayedInputKey, setDelayedInputKey] = useState(inputKey)

  useEffect(() => {
    if (debounceMs === 0) return

    const timeout = window.setTimeout(() => setDelayedInputKey(inputKey), debounceMs)
    return () => window.clearTimeout(timeout)
  }, [debounceMs, inputKey])

  const debouncedInputKey = debounceMs === 0 ? inputKey : delayedInputKey
  const debouncedInput = useMemo(() => JSON.parse(debouncedInputKey) as ClientSearchInput, [debouncedInputKey])
  const trimmedQuery = debouncedInput.query?.trim() ?? ''
  const canSearch =
    Boolean(debouncedInput.recent) ||
    hasStructuredSearch(debouncedInput) ||
    trimmedQuery.length >= CLIENT_SEARCH_MIN_CHARS

  const query = useQuery({
    queryKey: ['client-search', debouncedInput],
    queryFn: ({ signal }) => searchClients(debouncedInput, signal),
    enabled: enabled && canSearch,
    staleTime: 30 * 1000,
  })

  return {
    ...query,
    isDebouncing: enabled && inputKey !== debouncedInputKey,
    isTooShort:
      enabled &&
      !debouncedInput.recent &&
      !hasStructuredSearch(debouncedInput) &&
      trimmedQuery.length > 0 &&
      !canSearch,
  }
}

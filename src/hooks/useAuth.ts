'use client'

import { useQuery } from '@tanstack/react-query'

interface User {
  id: string
  email: string
  collection: string
  _verified?: boolean
}

export const useAuth = () => {
  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await fetch('/api/clients/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return null
        }
        throw new Error('Failed to fetch user data')
      }

      const userData = await response.json()
      return userData.user // null if not authenticated
    },
    staleTime: 1 * 60 * 1000, // 1 minute (shorter for better auth detection)
    retry: false,
    refetchOnWindowFocus: true, // Check auth when window gains focus
  })

  return {
    user: user as User | null,
    isLoading,
    error,
    isAuthenticated: !!user,
    refetch,
  }
}
'use client'

import { useQueryClient } from '@tanstack/react-query'

export const useAuthActions = () => {
  const queryClient = useQueryClient()

  const invalidateAuth = () => {
    queryClient.invalidateQueries({ queryKey: ['currentUser'] })
  }

  const logout = async () => {
    try {
      // Use Payload's built-in logout endpoint
      const response = await fetch('/api/clients/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        // Clear the user data from cache
        queryClient.setQueryData(['currentUser'], null)
        // Redirect to home
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return {
    invalidateAuth,
    logout,
  }
}
'use client'

import { Button } from '@/components/ui/button'

export function ClientLogoutButton() {
  const handleLogout = async () => {
    try {
      // Use Payload's built-in logout endpoint
      const response = await fetch('/api/clients/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        // Redirect to home
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-start pl-0">
      Sign Out
    </Button>
  )
}
'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ClientLogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      // Use Payload's logout API endpoint for clients
      const response = await fetch('/api/clients/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        router.push('/')
      } else {
        console.error('Logout failed')
        router.push('/') // Still redirect
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect on error
      router.push('/')
    }
  }

  return (
    <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-start pl-0">
      Sign Out
    </Button>
  )
}

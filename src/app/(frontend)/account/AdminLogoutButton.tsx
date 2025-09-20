'use client'

import { useRouter } from 'next/navigation'

export function AdminLogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      // Use Payload's logout API endpoint
      const response = await fetch('/api/admins/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        router.push('/login')
      } else {
        console.error('Logout failed')
        router.push('/login') // Still redirect
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect on error
      router.push('/login')
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
    >
      Log Out
    </button>
  )
}
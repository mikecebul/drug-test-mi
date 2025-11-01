'use client'

export function ClientLogoutButton({ children }: { children: React.ReactNode }) {
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
    <span onClick={handleLogout} className="w-full">
      {children}
    </span>
  )
}
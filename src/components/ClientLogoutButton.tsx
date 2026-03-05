'use client'

export function ClientLogoutButton({ children }: { children: React.ReactNode }) {
  const handleLogout = async () => {
    try {
      // Use Payload's built-in logout endpoint
      const _response = await fetch('/api/clients/logout', {
        method: 'POST',
        credentials: 'include',
      })

      // Always redirect to home, regardless of response
      // If no user is logged in, we still want to redirect
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
      // Still redirect to home even if there's an error
      window.location.href = '/'
    }
  }

  return (
    <span onClick={handleLogout} className="w-full">
      {children}
    </span>
  )
}
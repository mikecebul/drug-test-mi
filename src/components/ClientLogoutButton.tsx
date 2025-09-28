'use client'

import { Button } from '@/components/ui/button'
import { useAuthActions } from '@/hooks/useAuthActions'

export function ClientLogoutButton() {
  const { logout } = useAuthActions()

  return (
    <Button onClick={logout} variant="ghost" size="sm" className="w-full justify-start pl-0">
      Sign Out
    </Button>
  )
}

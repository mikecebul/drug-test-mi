'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClientSideURL } from '@/utilities/getURL'
import { toast } from 'sonner'

export const LogoutPage = () => {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch(`${getClientSideURL()}/api/clients/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        toast.success('Logged out successfully.')
        router.push('/login')
      } else {
        toast.error('Logout failed. Please try again.')
      }
    } catch (err) {
      toast.warning('You are already logged out.')
      router.push('/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Log Out</h1>
        <p className="text-muted-foreground">
          Are you sure you want to log out of your account?
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-center">Confirm Logout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            You will need to log in again to access your account.
          </p>

          <div className="flex flex-col space-y-3">
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="destructive"
              className="w-full"
            >
              {isLoggingOut ? 'Logging Out...' : 'Yes, Log Me Out'}
            </Button>

            <Button
              onClick={() => router.back()}
              variant="outline"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
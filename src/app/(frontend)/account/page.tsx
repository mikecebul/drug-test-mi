import { headers as getHeaders, cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '../../../payload.config'
import { AccountTabs } from './AccountTabs'
import { AdminLogoutButton } from './AdminLogoutButton'
import { Card, CardContent } from '@/components/ui/card'
import { Client } from '@/payload-types'
import { baseUrl } from '@/utilities/baseUrl'

export default async function Account() {
  const headers = await getHeaders()
  const cookieStore = await cookies()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  // Check if user has a token but isn't authenticated (likely unverified)
  const generalToken = cookieStore.get('payload-token')?.value

  if (!user) {
    // If there's a token but no user, check if they're unverified
    if (generalToken) {
      try {
        // Try to fetch user data directly using the token
        const response = await fetch(`${baseUrl}/api/clients/me`, {
          headers: {
            'Authorization': `JWT ${generalToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const userData = await response.json()

          // If user is null but API call succeeds, likely unverified
          if (userData.user === null || (userData.user && !userData.user._verified)) {
            redirect('/verify-email?resend=true')
          }
        }
      } catch (error) {
        // Continue to login redirect on error
      }

      // If we can't determine verification status, redirect to verify-email anyway
      redirect('/verify-email?resend=true')
    }
    redirect('/login?redirect=/account')
  }

  // Check if user is a client
  if (user.collection !== 'clients') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Account Access Restricted</h1>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="text-yellow-600">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">Admin Account Detected</h2>
                <p className="text-muted-foreground">
                  You are currently logged in as an administrator ({user.email}).
                  This account page is only available for client accounts.
                </p>
                <div className="flex justify-center space-x-4 pt-4">
                  <Link
                    href="/admin"
                    className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Go to Admin Dashboard
                  </Link>
                  <AdminLogoutButton />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return <AccountTabs user={user as Client} />
}
import { headers as getHeaders, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import type { Metadata } from 'next'

import config from '@payload-config'
import { LoginForm } from './LoginForm'
import { baseUrl } from '@/utilities/baseUrl'

export const metadata: Metadata = {
  title: 'Sign In | MI Drug Test',
  description:
    'Sign in to your account to view your drug test results and manage your appointments.',
}

export default async function Login() {
  const headers = await getHeaders()
  const cookieStore = await cookies()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  // Check if user has a token but isn't authenticated (likely unverified)
  const generalToken = cookieStore.get('payload-token')?.value

  if (user) {
    const redirectUrl = user.collection === 'clients' ? '/dashboard' : '/admin'
    redirect(`${redirectUrl}?message=${encodeURIComponent('You are already logged in.')}`)
  }

  // If there's a token but no user, check if they're unverified
  if (generalToken) {
    try {
      // Try to fetch user data directly using the token
      const response = await fetch(`${baseUrl}/api/clients/me`, {
        headers: {
          Authorization: `JWT ${generalToken}`,
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
      // Continue to login page on error
    }

    // If we can't determine verification status, redirect to verify-email anyway
    redirect('/verify-email?resend=true')
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Sign in</h1>
          <p className="text-muted-foreground">Enter your credentials to access your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}

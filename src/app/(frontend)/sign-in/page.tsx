import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import type { Metadata } from 'next'

import config from '@payload-config'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign In | MI Drug Test',
  description:
    'Sign in to your account to view your drug test results and manage your appointments.',
}

export default async function Login() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (user) {
    const redirectUrl = user.collection === 'clients' ? '/dashboard' : '/admin'
    redirect(`${redirectUrl}?message=${encodeURIComponent('You are already logged in.')}`)
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

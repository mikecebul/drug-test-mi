import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '../../../payload.config'
import { LogoutPage } from './LogoutPage'

export default async function Logout() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16">
        <div className="space-y-6 text-center">
          <h1 className="text-3xl font-bold">You are already logged out</h1>
          <p className="text-muted-foreground">
            What would you like to do next?
          </p>
          <div className="flex flex-col space-y-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Go to Home Page
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Log Back In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <LogoutPage />
    </div>
  )
}
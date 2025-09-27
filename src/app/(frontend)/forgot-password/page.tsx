import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'
import { RecoverPasswordForm } from './RecoverPasswordForm'

export default async function ForgotPassword() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(`/dashboard?message=${encodeURIComponent('Cannot recover password while logged in.')}`)
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Forgot Password</h1>
          <p className="text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>
        <RecoverPasswordForm />
      </div>
    </div>
  )
}
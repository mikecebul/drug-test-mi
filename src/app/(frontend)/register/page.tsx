import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'
import { RegistrationForm } from './RegistrationForm'

export default async function Register() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(
      `/account?message=${encodeURIComponent(
        'You are already logged in. Please log out to register a new account.',
      )}`,
    )
  }

  return <RegistrationForm />
}

import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import type { Metadata } from 'next'

import config from '@payload-config'
import { RegistrationForm } from './RegistrationForm'

export const metadata: Metadata = {
  title: 'Register | MI Drug Test',
  description: 'Create your account for faster booking and easy access to your drug test results.',
  openGraph: {
    title: 'Register | MI Drug Test',
    description: 'Create your account for faster booking and easy access to your drug test results.',
    images: [
      {
        url: '/api/og/register',
      },
    ],
  },
}

export default async function Register() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(
      `/dashboard?message=${encodeURIComponent(
        'You are already logged in. Please log out to register a new account.',
      )}`,
    )
  }

  return <RegistrationForm />
}

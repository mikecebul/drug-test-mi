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

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
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

  const params = await searchParams
  const email = typeof params.email === 'string' ? params.email : undefined
  const name = typeof params.name === 'string' ? params.name : undefined

  return <RegistrationForm initialEmail={email} initialName={name} />
}

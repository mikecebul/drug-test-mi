import React from 'react'
import type { Metadata } from 'next'

import { RegistrationForm } from './RegistrationForm'

export const metadata: Metadata = {
  title: 'Register | MI Drug Test',
  description: 'Create your account for faster booking and easy access to your drug test results.',
  openGraph: {
    title: 'Register | MI Drug Test',
    description:
      'Create your account for faster booking and easy access to your drug test results.',
    images: [
      {
        url: '/api/og/register',
      },
    ],
  },
}

export default async function Register() {
  return <RegistrationForm />
}

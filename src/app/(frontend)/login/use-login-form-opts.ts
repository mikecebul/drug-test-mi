'use client'

import { formOptions } from '@tanstack/react-form'
import { getClientSideURL } from '@/utilities/getURL'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export type LoginFormType = {
  email: string
  password: string
}

export const useLoginFormOpts = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/account'

  return formOptions({
    defaultValues: {
      email: '',
      password: '',
    } as LoginFormType,
    onSubmit: async ({ value: data, formApi: form }) => {
      try {
        const req = await fetch(`${getClientSideURL()}/api/clients/login`, {
          body: JSON.stringify({
            email: data.email,
            password: data.password,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        const res = await req.json()

        if (req.status >= 400) {
          const errorMessage = res.errors?.[0]?.message || res.message || 'Invalid credentials'
          // Check if the error is related to unverified email
          if (errorMessage.toLowerCase().includes('verify') || errorMessage.toLowerCase().includes('unverified')) {
            router.push('/verify-email?resend=true')
            return
          } else {
            toast.error(errorMessage)
          }
          return
        }

        // Show success toast and redirect
        toast.success('Logged in successfully!')
        router.push(redirectTo)
        form.reset()
      } catch (err) {
        toast.error('Something went wrong. Please try again.')
      }
    },
  })
}
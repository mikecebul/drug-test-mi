'use client'

import { formOptions } from '@tanstack/react-form'
import { getClientSideURL } from '@/utilities/getURL'
import { toast } from 'sonner'

export type ForgotPasswordFormType = {
  email: string
}

export const useForgotPasswordOpts = () => {
  return formOptions({
    defaultValues: {
      email: '',
    } as ForgotPasswordFormType,
    onSubmit: async ({ value: data, formApi: form }) => {
      try {
        const req = await fetch(`${getClientSideURL()}/api/clients/forgot-password`, {
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })

        if (req.status >= 400) {
          const res = await req.json()
          toast.error(res.errors?.[0]?.message || res.message || 'There was a problem while attempting to send you a password reset email. Please try again.')
          return
        }

        toast.info('Password reset email sent! Check your inbox for instructions.')
        form.reset()
      } catch (err) {
        toast.error('Something went wrong. Please try again.')
      }
    },
  })
}
'use client'

import { formOptions } from '@tanstack/react-form'
import { getClientSideURL } from '@/utilities/getURL'
import { toast } from 'sonner'

export type ResetPasswordFormType = {
  password: string
  confirmPassword: string
  token: string
}

export const useResetPasswordOpts = ({
  token,
}: {
  token: string | null
}) => {
  return formOptions({
    defaultValues: {
      password: '',
      confirmPassword: '',
      token: token || '',
    } as ResetPasswordFormType,
    onSubmit: async ({ value: data, formApi: form }) => {
      if (!data.token) {
        toast.error('Invalid reset token. Please request a new password reset link.')
        return
      }

      if (data.password !== data.confirmPassword) {
        toast.error('Passwords do not match.')
        return
      }

      try {
        const req = await fetch(`${getClientSideURL()}/api/clients/reset-password`, {
          body: JSON.stringify({
            password: data.password,
            token: data.token,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })

        if (req.status >= 400) {
          const res = await req.json()
          toast.error(res.errors?.[0]?.message || res.message || 'There was a problem while resetting your password. Please try again later.')
          return
        }

        const res = await req.json()

        // If successful, automatically log the user in
        if (res.user) {
          try {
            const loginReq = await fetch(`${getClientSideURL()}/api/clients/sign-in`, {
              body: JSON.stringify({
                email: res.user.email,
                password: data.password,
              }),
              headers: { 'Content-Type': 'application/json' },
              method: 'POST',
            })

            if (loginReq.ok) {
              // Show success toast and redirect to account
              toast.success('Password reset successfully! You are now logged in.')
              window.location.href = '/dashboard'
              return
            }
          } catch (loginErr) {
            // If auto-login fails, still show success but redirect to login
            toast.success('Password reset successfully! Please sign in with your new password.')
            window.location.href = '/sign-in'
            return
          }
        }

        toast.success('Password reset successfully! Please sign in with your new password.')
        window.location.href = '/sign-in'
      } catch (err) {
        toast.error('Something went wrong. Please try again.')
      }
    },
  })
}
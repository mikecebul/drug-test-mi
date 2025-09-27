'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useResetPasswordOpts } from './use-reset-password-opts'
import Link from 'next/link'

export const ResetPasswordForm = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const formOpts = useResetPasswordOpts({
    token,
  })

  const form = useAppForm({
    ...formOpts,
  })

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive text-center">Invalid Reset Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
          <div className="flex flex-col space-y-3">
            <Link
              href="/forgot-password"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2"
            >
              Request New Reset Link
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50"
            >
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }


  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Enter your new password below. Make sure it&apos;s secure and easy for you to remember.
          </p>

          <form.AppField
            name="password"
            validators={{
              onChange: z.string().min(6, 'Password must be at least 6 characters'),
            }}
          >
            {(formField) => (
              <formField.PasswordField label="New Password" autoComplete="new-password" required />
            )}
          </form.AppField>

          <form.AppField
            name="confirmPassword"
            validators={{
              onChangeListenTo: ['password'],
              onChange: ({ value, fieldApi }) => {
                const password = fieldApi.form.getFieldValue('password')
                if (password && value !== password) {
                  return { message: 'Passwords do not match' }
                }
                return undefined
              },
            }}
          >
            {(formField) => (
              <formField.PasswordField
                label="Confirm New Password"
                autoComplete="new-password"
                required
              />
            )}
          </form.AppField>

          {/* Hidden token field */}
          <form.AppField name="token" validators={{}}>
            {(formField) => <input type="hidden" value={formField.state.value} />}
          </form.AppField>

          <div className="space-y-4">
            <form.AppForm>
              <form.SubmitButton label="Reset Password" />
            </form.AppForm>

            <div className="text-center">
              <Link href="/sign-in" className="text-primary text-sm hover:underline">
                Back to Login
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

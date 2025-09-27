'use client'

import { Card, CardContent } from '@/components/ui/card'
import { z } from 'zod'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useForgotPasswordOpts } from './use-forgot-password-opts'
import Link from 'next/link'

export const RecoverPasswordForm = () => {
  const formOpts = useForgotPasswordOpts()

  const form = useAppForm({
    ...formOpts,
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <Card>
        <CardContent className="space-y-6 pt-6">
          <form.AppField
            name="email"
            validators={{
              onChange: z.string().min(1, 'Email is required').email('Invalid email address'),
            }}
          >
            {(formField) => <formField.EmailField label="Email Address" required />}
          </form.AppField>

          <div className="space-y-4">
            <form.AppForm>
              <form.SubmitButton label="Send Reset Link" />
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

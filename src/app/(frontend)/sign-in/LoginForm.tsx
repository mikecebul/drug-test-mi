'use client'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useSignInFormOpts } from './use-sign-in-form-opts'
import Link from 'next/link'

export const LoginForm = () => {
  const formOpts = useSignInFormOpts()
  const form = useAppForm({
    ...formOpts,
  })

  // Check if the form is successfully submitted
  const [isSubmitSuccessful] = useStore(form.store, (state) => [state.isSubmitSuccessful])

  return (
    <div className="w-full">
      <form
        method="post"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <Card className="@container">
          <CardContent className="space-y-4 p-6">
            <form.AppField
              name="email"
              validators={{
                onChange: z.string().min(1, 'Email is required').email('Invalid email address'),
              }}
            >
              {(formField) => <formField.EmailField label="Email Address" required />}
            </form.AppField>
            <form.AppField
              name="password"
              validators={{
                onChange: z.string().min(1, 'Password is required'),
              }}
            >
              {(formField) => <formField.PasswordField label="Password" required />}
            </form.AppField>
          </CardContent>
          <CardFooter className="flex flex-col items-center space-y-4">
            <form.AppForm>
              <form.SubmitButton label={'Sign in'} />
            </form.AppForm>
            <div className="space-y-2 text-center text-sm">
              <p>
                <Link href="/forgot-password" className="text-primary hover:underline">
                  Forgot your password?
                </Link>
              </p>
              <p>
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}

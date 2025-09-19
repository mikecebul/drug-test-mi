'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useAccountFormOpts } from './use-account-form-opts'

export const AccountForm = () => {

  // Fetch current user data with TanStack Query
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await fetch('/api/clients/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }

      const userData = await response.json()
      return userData.user
    },
  })

  const formOpts = useAccountFormOpts({
    user,
  })

  const form = useAppForm({
    ...formOpts,
  })

  // Watch email and password fields to show/hide confirmation fields
  const emailValue = useStore(form.store, (state) => state.values.email)
  const passwordValue = useStore(form.store, (state) => state.values.password)

  const showEmailConfirmation = emailValue && emailValue !== user?.email
  const showPasswordConfirmation = passwordValue && passwordValue.length > 0

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Failed to load user data. Please try again.
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
          <CardTitle>Edit Profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Update only the fields you want to change. Leave fields blank to keep current values.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          <form.AppField
            name="name"
            validators={{
              onChange: z.string().optional(),
            }}
          >
            {(formField) => (
              <formField.TextField
                label="Name"
              />
            )}
          </form.AppField>

          <form.AppField
            name="email"
            validators={{
              onChange: z
                .string()
                .email('Invalid email address')
                .optional()
                .or(z.literal('')),
            }}
          >
            {(formField) => (
              <formField.EmailField
                label="Email Address"
              />
            )}
          </form.AppField>

          {showEmailConfirmation && (
            <form.AppField
              name="confirmEmail"
              validators={{
                onChangeListenTo: ['email'],
                onChange: ({ value, fieldApi }) => {
                  const email = fieldApi.form.getFieldValue('email')
                  if (email && value !== email) {
                    return { message: 'Emails do not match' }
                  }
                  return undefined
                },
              }}
            >
              {(formField) => (
                <formField.EmailField
                  label="Confirm Email"
                  required
                />
              )}
            </form.AppField>
          )}

          <form.AppField
            name="phone"
            validators={{
              onChange: z
                .string()
                .optional()
                .refine((val) => !val || /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(val), { message: 'Invalid phone number' }),
            }}
          >
            {(formField) => (
              <formField.PhoneField
                label="Phone Number"
              />
            )}
          </form.AppField>

          <div className="border-t pt-6">
            <h4 className="text-sm font-medium mb-4">Change Password</h4>

            <form.AppField
              name="password"
              validators={{
                onChange: z
                  .string()
                  .optional()
                  .refine((val) => !val || val.length >= 6, { message: 'Password must be at least 6 characters' }),
              }}
            >
              {(formField) => (
                <formField.PasswordField
                  label="New Password"
                />
              )}
            </form.AppField>

            {showPasswordConfirmation && (
              <form.AppField
                name="passwordConfirm"
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
                    required
                  />
                )}
              </form.AppField>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <form.AppForm>
              <form.SubmitButton label="Save Changes" />
            </form.AppForm>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
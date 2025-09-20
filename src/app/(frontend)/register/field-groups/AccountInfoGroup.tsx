'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Mail, Shield } from 'lucide-react'
import { z } from 'zod'
import { AccountInfoFields } from '../use-registration-form-opts'
import { checkEmailExists } from '../actions'

const defaultValues: AccountInfoFields = {
  email: '',
  password: '',
  confirmPassword: '',
}

export const AccountInfoGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Account Info',
  },

  render: function Render({ group, title }) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <Shield className="text-primary mr-3 h-6 w-6" />
          <h2 className="text-foreground text-xl font-semibold">{title}</h2>
        </div>

        <group.AppField
          name="email"
          validators={{
            onChange: z
              .email('Please enter a valid email address'),
            onChangeAsyncDebounceMs: 300,
            onChangeAsync: async ({ value }) => {
              if (!value || !z.email().safeParse(value).success) {
                return undefined // Skip validation if email is empty or invalid format
              }
              console.log('Checking if email exists:', value)

              try {
                const emailExists = await checkEmailExists(value)
                console.log('Email exists result:', emailExists)
                if (emailExists) {
                  const errorMessage = 'An account with this email already exists'
                  console.log('Returning error message:', errorMessage)
                  return errorMessage
                }
              } catch (error) {
                console.warn('Failed to check email existence:', error)
                // Don't block registration if the check fails
              }

              console.log('No error, returning undefined')
              return undefined
            },
          }}
        >
          {(field) => (
            <field.EmailField
              label='Email Address'
              required
            />
          )}
        </group.AppField>

        <group.AppField
          name="password"
          validators={{
            onChange: z
              .string()
              .min(8, 'Password must be at least 8 characters')
              .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
              .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
              .regex(/[0-9]/, 'Password must contain at least one number'),
          }}
        >
          {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
        </group.AppField>

        <group.AppField
          name="confirmPassword"
          validators={{
            onChange: z.string().min(1, 'Please confirm your password'),
            onBlur: ({ value, fieldApi }) => {
              const password = fieldApi.form.getFieldValue('accountInfo.password')
              if (value && password && value !== password) {
                return 'Passwords do not match'
              }
              return undefined
            },
          }}
        >
          {(field) => <field.PasswordField label="Confirm Password" required autoComplete="new-password" />}
        </group.AppField>
      </div>
    )
  },
})

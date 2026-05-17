'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'

export const AccountPasswordFields = withFieldGroup({
  defaultValues: {
    password: '',
    confirmPassword: '',
  },
  render: function Render({ group }) {
    return (
      <>
        <group.AppField name="password">
          {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
        </group.AppField>

        <group.AppField
          name="confirmPassword"
          validators={{
            onChangeListenTo: ['password'],
            onChange: ({ value }) => {
              const password = group.getFieldValue('password')
              if (password && value !== password) {
                return { message: "Passwords don't match" }
              }
              return undefined
            },
          }}
        >
          {(field) => <field.PasswordField label="Confirm Password" required autoComplete="new-password" />}
        </group.AppField>
      </>
    )
  },
})

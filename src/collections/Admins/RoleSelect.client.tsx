'use client'

import { SelectField, useAuth, useField } from '@payloadcms/ui'
import type { TypedUser } from 'payload'
import { Option, SelectFieldClientComponent } from 'payload'

export const RoleSelectClient: SelectFieldClientComponent = ({ path, validate }) => {
  const { value, setValue } = useField<string>({ path })
  const { user } = useAuth<TypedUser>()

  const options = () => {
    if (user?.collection !== 'admins') return []
    if (user?.role === 'superAdmin')
      return [
        {
          label: 'Super Admin',
          value: 'superAdmin',
        },
        {
          label: 'Admin',
          value: 'admin',
        },
      ]
    return [
      {
        label: 'Admin',
        value: 'admin',
      },
    ]
  }

  const onChange = (option: Option | Option[]) => {
    // prevent admins from creating super admins
    if (user?.collection === 'admins' && user?.role !== 'superAdmin' && value === 'superAdmin') return

    setValue(option)
  }

  return (
    <>
      <label className="field-label">Role Select</label>
      <SelectField
        path={path}
        field={{
          name: path,
          hasMany: false,
          options: options(),
        }}
        readOnly={value === 'superAdmin'}
        value={value}
        onChange={onChange}
        validate={validate}
      />
    </>
  )
}

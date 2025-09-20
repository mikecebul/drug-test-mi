'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { User, Phone } from 'lucide-react'
import { z } from 'zod'
import { GENDER_OPTIONS } from '../types'
import type { PersonalInfoFields } from '../use-registration-form-opts'

const defaultValues: PersonalInfoFields = {
  firstName: '',
  lastName: '',
  gender: '',
  dob: '',
  phone: '',
}

export const PersonalInfoGroup = withFieldGroup({
  defaultValues,
  props: {
    title: 'Personal Information',
  },

  render: function Render({ group, title }) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <User className="text-primary mr-3 h-6 w-6" />
          <h2 className="text-foreground text-xl font-semibold">{title}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <group.AppField
            name="firstName"
            validators={{
              onChange: z.string().min(1, 'First name is required'),
            }}
          >
            {(field) => <field.TextField label="First Name" required />}
          </group.AppField>

          <group.AppField
            name="lastName"
            validators={{
              onChange: z.string().min(1, 'Last name is required'),
            }}
          >
            {(field) => <field.TextField label="Last Name" required />}
          </group.AppField>
        </div>

        <group.AppField
          name="gender"
          validators={{
            onChange: z.string().min(1, 'Please select a gender'),
          }}
        >
          {(field) => <field.SelectField label="Gender" options={GENDER_OPTIONS} required />}
        </group.AppField>

        <group.AppField name="dob">
          {(field) => <field.DobField label="Date of Birth" required />}
        </group.AppField>

        <group.AppField
          name="phone"
          validators={{
            onChange: z
              .string()
              .min(1, 'Phone number is required')
              .regex(
                /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
                'Please enter a valid phone number',
              ),
          }}
        >
          {(field) => <field.PhoneField label="Phone Number" required />}
        </group.AppField>
      </div>
    )
  },
})

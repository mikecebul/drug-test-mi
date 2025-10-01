'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { User, Phone } from 'lucide-react'
import { z } from 'zod'
import { GENDER_OPTIONS } from '../types'
import type { RegistrationFormType } from '../schemas/registrationSchemas'

// Export the schema for reuse in step validation
export const personalInfoFieldSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required' }),
  lastName: z.string().min(1, { error: 'Last name is required' }),
  gender: z.string().min(1, { error: 'Please select a gender' }),
  dob: z.union([
    z.string().min(1, { error: 'Date of birth is required' }),
    z.date({ error: 'Date of birth is required' })
  ]).refine((val) => {
    const date = typeof val === 'string' ? new Date(val) : val
    const thirteenYearsAgo = new Date()
    thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13)
    return date <= thirteenYearsAgo
  }, {
    message: 'You must be at least 13 years old',
  }),
  phone: z
    .string()
    .min(1, { error: 'Phone number is required' })
    .regex(/^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, {
      error: 'Please enter a valid phone number',
    }),
})

const defaultValues: RegistrationFormType['personalInfo'] = {
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
              onChange: personalInfoFieldSchema.shape.firstName,
            }}
          >
            {(field) => <field.TextField label="First Name" required />}
          </group.AppField>

          <group.AppField
            name="lastName"
            validators={{
              onChange: personalInfoFieldSchema.shape.lastName,
            }}
          >
            {(field) => <field.TextField label="Last Name" required />}
          </group.AppField>
        </div>

        <group.AppField
          name="gender"
          validators={{
            onChange: personalInfoFieldSchema.shape.gender,
          }}
        >
          {(field) => <field.SelectField label="Gender" options={GENDER_OPTIONS} required />}
        </group.AppField>

        <group.AppField
          name="dob"
          validators={{
            onChange: personalInfoFieldSchema.shape.dob,
          }}
        >
          {(field) => <field.DobField label="Date of Birth" required />}
        </group.AppField>

        <group.AppField
          name="phone"
          validators={{
            onChange: personalInfoFieldSchema.shape.phone,
          }}
        >
          {(field) => <field.PhoneField label="Phone Number" required />}
        </group.AppField>
      </div>
    )
  },
})

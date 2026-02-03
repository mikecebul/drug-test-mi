'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { User } from 'lucide-react'
import { z } from 'zod'
import { GENDER_OPTIONS } from '../types'
import type { RegistrationFormType } from '../schemas/registrationSchemas'

// Export the schema for reuse in step validation
export const personalInfoFieldSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required' }),
  lastName: z.string().min(1, { error: 'Last name is required' }),
  middleInitial: z.string().max(1, { error: 'Middle initial must be a single character' }).optional(),
  gender: z.string().min(1, { error: 'Please select a gender' }),
  dob: z.union([
    z.string().min(1, { error: 'Date of birth is required' }),
    z.date({ error: 'Date of birth is required' })
  ])
    .refine((val) => {
      const date = typeof val === 'string' ? new Date(val) : val
      if (isNaN(date.getTime())) return false
      // Year must be in reasonable range (1900 - current year)
      const year = date.getFullYear()
      const currentYear = new Date().getFullYear()
      return year >= 1900 && year <= currentYear
    }, {
      message: 'Please enter a valid date',
    })
    .refine((val) => {
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
  headshot: z.instanceof(File).optional().nullable(),
})

const defaultValues: RegistrationFormType['personalInfo'] = {
  firstName: '',
  lastName: '',
  middleInitial: '',
  gender: '',
  dob: '',
  phone: '',
  headshot: null,
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

          <group.AppField
            name="middleInitial"
            validators={{
              onChange: personalInfoFieldSchema.shape.middleInitial,
            }}
          >
            {(field) => (
              <field.TextField
                label="Middle Initial"
                description="Optional, single letter"
              />
            )}
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

        <group.AppField
          name="headshot"
          validators={{
            onChange: personalInfoFieldSchema.shape.headshot,
          }}
        >
          {(field) => (
            <field.ImageUploadField
              label="Headshot Photo"
              description="Optional photo for identification during testing. You can take a photo or upload one."
              accept="image/*"
              maxSize={10 * 1024 * 1024}
              aspectRatio={1}
            />
          )}
        </group.AppField>
      </div>
    )
  },
})

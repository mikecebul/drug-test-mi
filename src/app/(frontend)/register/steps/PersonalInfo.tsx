'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { GENDER_OPTIONS } from '../types'
import type { FormValues } from '../validators'

const PersonalInfoFields = withFieldGroup<FormValues['personalInfo'], never>({
  defaultValues: getRegisterClientFormOpts().defaultValues.personalInfo,

  render: function Render({ group }) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Personal Information</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <group.AppField name="firstName">
            {(field) => <field.TextField label="First Name" required />}
          </group.AppField>

          <group.AppField name="middleInitial">
            {(field) => <field.TextField label="Middle Initial" description="Single letter" required />}
          </group.AppField>

          <group.AppField name="lastName">
            {(field) => <field.TextField label="Last Name" required />}
          </group.AppField>
        </div>

        <group.AppField name="gender">
          {(field) => <field.SelectField label="Gender" options={GENDER_OPTIONS} required />}
        </group.AppField>

        <group.AppField name="dob">
          {(field) => <field.DobField label="Date of Birth" required />}
        </group.AppField>

        <group.AppField name="phone">
          {(field) => <field.PhoneField label="Phone Number" required />}
        </group.AppField>

      </div>
    )
  },
})

export function PersonalInfoStep({ form }: { form: any }) {
  return (
    <PersonalInfoFields
      form={form}
      fields={{
        firstName: 'personalInfo.firstName',
        middleInitial: 'personalInfo.middleInitial',
        lastName: 'personalInfo.lastName',
        gender: 'personalInfo.gender',
        dob: 'personalInfo.dob',
        phone: 'personalInfo.phone',
      } as never}
    />
  )
}

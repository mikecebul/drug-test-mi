'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { GENDER_OPTIONS } from '@/app/(frontend)/register/types'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import type { FormValues } from '../validators'

const PersonalInfoFields = withFieldGroup<FormValues['personalInfo'], never>({
  defaultValues: getRegisterClientFormOpts().defaultValues.personalInfo,

  render: function Render({ group }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Personal Information" description="Basic client information" />

        {/* Name fields in flex row */}
        <div className="@container">
          <div className="flex flex-col gap-8 @min-2xl:flex-row">
            <div className="flex-1">
              <group.AppField name="firstName">
                {(field) => <field.TextField label="First Name" required />}
              </group.AppField>
            </div>
            <div className="w-full @lg:w-24">
              <group.AppField name="middleInitial">
                {(field) => <field.TextField label="M.I." required />}
              </group.AppField>
            </div>
            <div className="flex-1">
              <group.AppField name="lastName">
                {(field) => <field.TextField label="Last Name" required />}
              </group.AppField>
            </div>
          </div>
        </div>

        {/* Other fields in 2-column grid */}
        <div className="@container grid grid-cols-2 gap-5">
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
        lastName: 'personalInfo.lastName',
        middleInitial: 'personalInfo.middleInitial',
        gender: 'personalInfo.gender',
        dob: 'personalInfo.dob',
        phone: 'personalInfo.phone',
      } as never}
    />
  )
}

'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { GENDER_OPTIONS } from '@/app/(frontend)/register/types'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'

export const PersonalInfoStep = withForm({
  ...getRegisterClientFormOpts('personalInfo'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Personal Information" description="Basic client information" />

        <div className="@container grid grid-cols-2 gap-5">
          <form.AppField name="personalInfo.firstName">
            {(field) => <field.TextField label="First Name" required colSpan="1" />}
          </form.AppField>

          <form.AppField name="personalInfo.lastName">
            {(field) => <field.TextField label="Last Name" required colSpan="1" />}
          </form.AppField>

          <form.AppField name="personalInfo.gender">
            {(field) => <field.SelectField label="Gender" options={GENDER_OPTIONS} required />}
          </form.AppField>

          <form.AppField name="personalInfo.dob">
            {(field) => <field.DobField label="Date of Birth" required colSpan="1" />}
          </form.AppField>

          <form.AppField name="personalInfo.phone">
            {(field) => <field.PhoneField label="Phone Number" required colSpan="1" />}
          </form.AppField>
        </div>
      </div>
    )
  },
})

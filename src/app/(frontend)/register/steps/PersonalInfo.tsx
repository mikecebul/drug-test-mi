'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { getRegisterClientFormOpts } from '../shared-form'
import { GENDER_OPTIONS } from '../types'
import { personalInfoSchema } from '../validators'
import { RegisterNavigation } from '../components/Navigation'
import type { RegisterStepProps } from './types'

export const PersonalInfoStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as RegisterStepProps,
  render: function Render(props) {
    const { form } = props
    const body = (
      <div className="wizard-content mb-8 flex-1 space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Personal Information</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <form.AppField name="personalInfo.firstName">
            {(field) => <field.TextField label="First Name" required />}
          </form.AppField>

          <form.AppField name="personalInfo.middleInitial">
            {(field) => <field.TextField label="Middle Initial" description="Single letter" required />}
          </form.AppField>

          <form.AppField name="personalInfo.lastName">
            {(field) => <field.TextField label="Last Name" required />}
          </form.AppField>
        </div>

        <form.AppField name="personalInfo.gender">
          {(field) => <field.SelectField label="Gender" options={GENDER_OPTIONS} required />}
        </form.AppField>

        <form.AppField name="personalInfo.dob">
          {(field) => <field.DobField label="Date of Birth" required />}
        </form.AppField>

        <form.AppField name="personalInfo.phone">
          {(field) => <field.PhoneField label="Phone Number" required />}
        </form.AppField>
      </div>
    )

    if (props.mode === 'body') {
      return body
    }

    return (
      <form.FormGroup
        name="personalInfo"
        validationLogic={revalidateLogic()}
        validators={{ onDynamic: personalInfoSchema.shape.personalInfo }}
        onGroupSubmit={() => props.onNext()}
        onGroupSubmitInvalid={() => props.onInvalid()}
      >
        {(group) => (
          <>
            {body}

            <RegisterNavigation
              isFirstStep={props.isFirstStep}
              isLastStep={props.isLastStep}
              isSubmitting={props.isSubmitting}
              isNextDisabled={group.state.meta.isSubmitting}
              onBack={() => props.onBack()}
              onNext={() => group.handleSubmit()}
            />
          </>
        )}
      </form.FormGroup>
    )
  },
})

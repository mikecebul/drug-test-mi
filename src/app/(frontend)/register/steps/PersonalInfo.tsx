'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { getRegisterClientFormOpts } from '../shared-form'
import { GENDER_OPTIONS } from '../types'
import { personalInfoSchema } from '../validators'
import { RegisterNavigation } from '../components/Navigation'
import { getFirstGroupError } from '@/views/DrugTestWizard/workflows/form-group-errors'

export const PersonalInfoStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as {
    isFirstStep?: boolean
    isLastStep?: boolean
    isSubmitting?: boolean
    onBack?: () => void
    onNext?: () => void
    onInvalid?: () => void
  },
  render: function Render({ form, isFirstStep, isLastStep, isSubmitting, onBack, onNext, onInvalid }) {
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

    if (!onNext) {
      return body
    }

    return (
      <form.FormGroup
        name="personalInfo"
        validationLogic={revalidateLogic()}
        validators={{ onDynamic: personalInfoSchema.shape.personalInfo }}
        onGroupSubmit={() => onNext?.()}
        onGroupSubmitInvalid={() => onInvalid?.()}
      >
        {(group) => (
          <>
            {body}

            {getFirstGroupError(group.state.meta.errors) || getFirstGroupError(group.state.meta.errorMap) ? (
              <div className="text-destructive mb-4 space-y-1 text-sm">
                <p>{getFirstGroupError(group.state.meta.errors) || getFirstGroupError(group.state.meta.errorMap)}</p>
              </div>
            ) : null}
            <RegisterNavigation
              isFirstStep={isFirstStep ?? false}
              isLastStep={isLastStep ?? false}
              isSubmitting={isSubmitting ?? false}
              isNextDisabled={!group.state.meta.canSubmit || group.state.meta.isSubmitting}
              onBack={() => onBack?.()}
              onNext={() => group.handleSubmit()}
            />
          </>
        )}
      </form.FormGroup>
    )
  },
})

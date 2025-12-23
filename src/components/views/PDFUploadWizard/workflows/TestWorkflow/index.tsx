import { useAppForm } from '@/blocks/Form/hooks/form'
import { WizardHeader } from '../../components/WizardHeader'
import { useStore } from '@tanstack/react-form'
import { VerifyClientFieldGroup } from './VerifyClientFieldGroup'
import { VerifyMedicationsFieldGroup } from './VerifyMedicationsFieldGroup'
import { testWorkflowFormOpts } from './shared-form'
import { FormNavigation } from '../../components/FormNavigation'
import { steps } from './validators'
import { Alert, AlertTitle } from '@/components/ui/alert'

export function TestWorkflow() {
  const form = useAppForm({
    ...testWorkflowFormOpts,
    onSubmit: ({ value, formApi }) => {
      console.log('Submission')
      if (value.section === 'clientData') {
        formApi.setFieldValue('section', 'medicationsData')
      }
      if (value.section === 'medicationsData') {
        alert(JSON.stringify(value, null, 2))
      }
    },
  })

  const [section, errors] = useStore(form.store, (state) => [state.values.section, state.errors])

  return (
    <>
      <WizardHeader
        title="Collect Lab Sample"
        description="Create a pending drug test after collecting the sample to be shipped to the lab."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-1 flex-col"
      >
        <div className="wizard-content mb-8 flex-1">
          {section === 'clientData' && <VerifyClientFieldGroup form={form} title="Select Client" />}

          {section === 'medicationsData' && (
            <VerifyMedicationsFieldGroup
              form={form}
              title="Verify Medications"
              description="Just a test"
            />
          )}
        </div>
        {/* <Alert>
          <AlertTitle>{errors.length > 0 ? errors[0].message : ""}</AlertTitle>
        </Alert> */}

        <FormNavigation form={form} sections={steps} />
      </form>
    </>
  )
}

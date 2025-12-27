import { useAppForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { collectLabFormOpts } from './shared-form'
import { CollectLabNavigation } from './components/Navigation'
import { ClientStep } from './steps/Client/Step'
import { MedicationsStep } from './steps/medications/Step'
import { CollectionStep } from './steps/Collection'
import { ConfirmStep } from './steps/Confirm'
import { EmailsStep } from './steps/Emails'

export function CollectLabWorkflow() {
  const form = useAppForm({
    ...collectLabFormOpts,
    onSubmit: ({ value, formApi }) => {
      console.log('Submission')
      switch (value.step) {
        case 'client':
          formApi.setFieldValue('step', 'medications')
          break
        case 'medications':
          formApi.setFieldValue('step', 'collection')
          break
        case 'collection':
          formApi.setFieldValue('step', 'confirm')
          break
        case 'confirm':
          formApi.setFieldValue('step', 'reviewEmails')
          break
        case 'reviewEmails':
          alert(JSON.stringify(value.emails, null, 2))
          break
      }
    },
  })

  const [step] = useStore(form.store, (state) => [state.values.step])

  const renderStep = () => {
    switch (step) {
      case 'client':
        return <ClientStep form={form} />
      case 'medications':
        return <MedicationsStep form={form} />
      case 'collection':
        return <CollectionStep form={form} />
      case 'confirm':
        return <ConfirmStep form={form} />
      case 'reviewEmails':
        return <EmailsStep form={form} />
      default:
        return <ClientStep form={form} />
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-1 flex-col"
    >
      <div className="wizard-content mb-8 flex-1">{renderStep()}</div>
      <CollectLabNavigation form={form} />
    </form>
  )
}

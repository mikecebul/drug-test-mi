import { useAppForm } from '@/blocks/Form/hooks/form'
import { WizardHeader } from '../../components/WizardHeader'
import { useStore } from '@tanstack/react-form'
import { collectLabFormOpts } from './shared-form'
import { CollectLabNavigation } from './components/Navigation'
import { ClientGroup } from './groups/Client'
import { MedicationsGroup } from './groups/Medications'
import { CollectionGroup } from './groups/Collection'
import { PDFUploadWizardClient } from '../../PDFUploadWizardClient'
import { ConfirmGroup } from './groups/Confirm'

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
          alert(JSON.stringify(value.collection, null, 2))
          break
      }
    },
  })

  const [step] = useStore(form.store, (state) => [state.values.step])

  const renderStep = () => {
    switch (step) {
      case 'client':
        return <ClientGroup form={form} title="Select Client" />
      case 'medications':
        return <MedicationsGroup form={form} title="Verify Medications" description="" />
      case 'collection':
        return <CollectionGroup form={form} title="Verify Collection Details" description="" />
      case 'confirm':
        return <ConfirmGroup form={form} title="Confirm Collection Details" />
      default:
        return <ClientGroup form={form} title="Select Client" />
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

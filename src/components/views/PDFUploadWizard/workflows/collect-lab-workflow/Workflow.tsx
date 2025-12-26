import { useAppForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { collectLabFormOpts } from './shared-form'
import { CollectLabNavigation } from './components/Navigation'
import { ClientGroup } from './groups/Client'
import { MedicationsGroup } from './groups/Medications'
import { CollectionGroup } from './groups/Collection'
import { ConfirmGroup } from './groups/Confirm'
import { EmailsGroup } from './groups/Emails'
import { getClients } from './queries/getClients'
import { Suspense } from 'react'

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
        return <ClientGroup form={form} title="Select Client" />
      case 'medications':
        return <MedicationsGroup form={form} title="Verify Medications" description="" />
      case 'collection':
        return (
          <CollectionGroup
            form={form}
            title="Collection Details"
            description="Verify the collection details are correct."
          />
        )
      case 'confirm':
        return <ConfirmGroup form={form} title="Confirm Collection" />
      case 'reviewEmails':
        return <EmailsGroup form={form} title="Review Collection Notification" description="" />
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

'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { getCollectLabFormOpts } from '../../shared-form'
import { SimpleClient } from '../../../components/client/getClients'
import { ClientStepUI } from '../../../components/client/ClientStepUI'

export const ClientStep = withForm({
  ...getCollectLabFormOpts('client'),

  render: function Render({ form }) {
    // Get selected client ID and data from form state
    const selectedClient = useStore(form.store, (state) => state.values.client)

    const handleSelectClient = (client: SimpleClient) => {
      form.setFieldValue('client.id', client.id)
      form.setFieldValue('client.firstName', client.firstName)
      form.setFieldValue('client.lastName', client.lastName)
      form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
      form.setFieldValue('client.email', client.email)
      form.setFieldValue('client.dob', client.dob ?? null)
      form.setFieldValue('client.headshot', client.headshot ?? null)
      form.setFieldValue('client.headshotId', client.headshotId ?? null)
    }

    return (
      <form.AppField name="client.id">
        {(idField) => (
          <ClientStepUI
            selectedClient={selectedClient}
            onSelectClient={handleSelectClient}
            errors={idField.state.meta.errors.map((e) => e?.message || 'Validation error')}
            returnToWorkflow="collect-lab"
          />
        )}
      </form.AppField>
    )
  },
})

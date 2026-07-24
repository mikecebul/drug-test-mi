'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useMemo, useCallback } from 'react'
import { getInstantTestFormOpts } from '../../shared-form'
import { SimpleClient } from '../../../components/client/getClients'
import { ClientStepUI } from '../../../components/client/ClientStepUI'
import { saveFileToStorage } from '../../utils/fileStorage'
import { useExtractPdfQuery } from '../../../../queries'
import { useClientSearch } from '../../../components/client/useClientSearch'

export const ClientStep = withForm({
  ...getInstantTestFormOpts(),

  render: function Render({ form }) {
    // Get selected client ID and data from form state
    const selectedClient = useStore(form.store, (state) => state.values.client)
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)

    // Get extracted data from PDF
    const { data: extractedData } = useExtractPdfQuery(uploadedFile, 'instant-test')
    const donorName = extractedData?.donorName ?? null

    const matchingClientsQuery = useClientSearch(
      { name: donorName || undefined, limit: 10 },
      { enabled: Boolean(donorName), debounceMs: 0 },
    )

    // Convert ClientMatch to SimpleClient by adding initials and preserve match info
    const suggestedMatches = useMemo(() => {
      return [...(matchingClientsQuery.data?.exactMatches ?? []), ...(matchingClientsQuery.data?.possibleMatches ?? [])]
    }, [matchingClientsQuery.data])

    const handleSelectClient = useCallback(
      (client: SimpleClient) => {
        form.setFieldValue('client.id', client.id)
        form.setFieldValue('client.firstName', client.firstName)
        form.setFieldValue('client.lastName', client.lastName)
        form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
        form.setFieldValue('client.email', client.email)
        form.setFieldValue('client.dob', client.dob ?? null)
        form.setFieldValue('client.headshot', client.headshot ?? null)
        form.setFieldValue('client.headshotId', client.headshotId ?? null)
        form.setFieldValue('client.phone', client.phone ?? null)
        form.setFieldValue('client.gender', client.gender ?? null)
        form.setFieldValue('client.referralType', client.referralType ?? null)
        form.setFieldValue('client.referralTitle', client.referralTitle ?? null)
      },
      [form],
    )

    // Save file to localStorage before navigating to registration
    const handleRegisterNewClient = () => {
      if (uploadedFile) {
        saveFileToStorage(uploadedFile)
      }
    }

    return (
      <form.AppField name="client.id">
        {(idField) => (
          <ClientStepUI
            selectedClient={selectedClient}
            onSelectClient={handleSelectClient}
            errors={idField.state.meta.errors.map((e) =>
              typeof e === 'string' ? e : (e as { message?: string } | undefined)?.message || 'Validation error',
            )}
            returnToWorkflow="instant-test"
            onRegisterNewClient={handleRegisterNewClient}
            suggestedMatches={suggestedMatches}
            donorName={donorName}
            isLoading={matchingClientsQuery.isFetching}
          />
        )}
      </form.AppField>
    )
  },
})

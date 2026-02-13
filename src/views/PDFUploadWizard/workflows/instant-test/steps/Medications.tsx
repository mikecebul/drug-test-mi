'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getInstantTestFormOpts } from '../shared-form'
import { useEffect } from 'react'
import { useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getClientMedications } from '../../components/medications/helpers'
import { MedicationFieldGroup } from '../../components/medications/MedicationFieldGroup'
import { invalidateWizardClientDerivedData } from '../../../queries'

export const MedicationsStep = withForm({
  ...getInstantTestFormOpts('medications'),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const client = useStore(form.store, (state) => state.values.client)

    const {
      data: medications,
      isLoading,
      error,
      refetch,
    } = useQuery({
      queryKey: ['medications', client.id],
      queryFn: () => getClientMedications(client.id),
      staleTime: Infinity,
      enabled: !!client.id,
      retry: 2, // Retry failed requests
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })

    const handleRefresh = async () => {
      const result = await refetch()
      if (result.data) {
        form.setFieldValue('medications', result.data as any)
      }
    }

    // Initialize form only when empty
    useEffect(() => {
      const formMeds = form.getFieldValue('medications')
      const formIsEmpty = !formMeds || formMeds.length === 0
      if (formIsEmpty && medications && medications.length > 0) {
        form.setFieldValue('medications', medications as any)
      }
    }, [medications, form])

    return (
      <MedicationFieldGroup
        form={form}
        fields={{
          medications: 'medications',
        }}
        client={client}
        isLoading={isLoading}
        error={error}
        handleRefresh={handleRefresh}
        onHeadshotLinked={(url, docId) => {
          form.setFieldValue('client.headshot', url)
          form.setFieldValue('client.headshotId', docId)
          invalidateWizardClientDerivedData(queryClient, { clientId: client.id })
        }}
      />
    )
  },
})

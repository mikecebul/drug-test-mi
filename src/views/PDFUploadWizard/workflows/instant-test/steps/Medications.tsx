'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getInstantTestFormOpts } from '../shared-form'
import { useEffect } from 'react'
import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { getClientMedications } from '../../components/medications/helpers'
import { MedicationFieldGroup } from '../../components/medications/MedicationFieldGroup'

export const MedicationsStep = withForm({
  ...getInstantTestFormOpts('medications'),

  render: function Render({ form }) {
    const client = useStore(form.store, (state) => state.values.client)

    const {
      data: medications,
      isLoading,
      refetch,
    } = useQuery({
      queryKey: ['medications', client.id],
      queryFn: () => getClientMedications(client.id),
      staleTime: Infinity,
      enabled: !!client.id,
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
        handleRefresh={handleRefresh}
        onHeadshotLinked={(url, docId) => {
          form.setFieldValue('client.headshot', url)
          form.setFieldValue('client.headshotId', docId)
        }}
      />
    )
  },
})

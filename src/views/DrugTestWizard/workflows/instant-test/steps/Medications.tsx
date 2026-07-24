'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getInstantTestFormOpts } from '../shared-form'
import { useEffect } from 'react'
import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { getClientMedications } from '../../components/medications/helpers'
import { MedicationFieldGroup } from '../../components/medications/MedicationFieldGroup'

export const MedicationsStep = withForm({
  ...getInstantTestFormOpts(),

  render: function Render({ form }) {
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
        onClientUpdated={(updated) => {
          if (updated.firstName !== undefined) form.setFieldValue('client.firstName', updated.firstName)
          if (updated.middleInitial !== undefined) form.setFieldValue('client.middleInitial', updated.middleInitial)
          if (updated.lastName !== undefined) form.setFieldValue('client.lastName', updated.lastName)
          if (updated.email !== undefined) form.setFieldValue('client.email', updated.email)
          if (updated.dob !== undefined) form.setFieldValue('client.dob', updated.dob)
          if (updated.phone !== undefined) form.setFieldValue('client.phone', updated.phone)
          if (updated.gender !== undefined) form.setFieldValue('client.gender', updated.gender)
          if (updated.headshot !== undefined) form.setFieldValue('client.headshot', updated.headshot)
          if (updated.headshotId !== undefined) form.setFieldValue('client.headshotId', updated.headshotId)
          if (updated.referralType !== undefined) form.setFieldValue('client.referralType', updated.referralType)
          if (updated.referralTitle !== undefined) form.setFieldValue('client.referralTitle', updated.referralTitle)
        }}
      />
    )
  },
})

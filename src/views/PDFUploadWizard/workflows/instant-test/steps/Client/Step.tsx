'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useMemo, useEffect, useRef, useCallback } from 'react'
import { getInstantTestFormOpts } from '../../shared-form'
import { SimpleClient } from '../../../components/client/getClients'
import { ClientStepUI } from '../../../components/client/ClientStepUI'
import { saveFileToStorage } from '../../utils/fileStorage'
import { useExtractPdfQuery, useFindMatchingClientsQuery } from '../../../../queries'

export const ClientStep = withForm({
  ...getInstantTestFormOpts('client'),

  render: function Render({ form }) {
    // Get selected client ID and data from form state
    const selectedClient = useStore(form.store, (state) => state.values.client)
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const hasAutoSelected = useRef(false)

    // Get extracted data from PDF
    const { data: extractedData } = useExtractPdfQuery(uploadedFile, '15-panel-instant')
    const donorName = extractedData?.donorName ?? null

    // Parse donor name into parts
    const { firstName, lastName, middleInitial } = useMemo(() => {
      if (!donorName) {
        return { firstName: undefined, lastName: undefined, middleInitial: undefined }
      }

      const nameParts = donorName.split(/\s+/)
      if (nameParts.length < 2) {
        return { firstName: undefined, lastName: undefined, middleInitial: undefined }
      }

      return {
        firstName: nameParts[0],
        lastName: nameParts[nameParts.length - 1],
        middleInitial: nameParts.length === 3 ? nameParts[1].charAt(0) : undefined,
      }
    }, [donorName])

    // Query for matching clients based on donor name
    const matchingClientsQuery = useFindMatchingClientsQuery(firstName, lastName, middleInitial)

    // Convert ClientMatch to SimpleClient by adding initials and preserve match info
    const suggestedMatches = useMemo(() => {
      return (matchingClientsQuery.data?.matches ?? []).map((match) => ({
        id: match.id,
        firstName: match.firstName,
        lastName: match.lastName,
        middleInitial: match.middleInitial ?? undefined,
        email: match.email,
        dob: match.dob ?? undefined,
        headshot: match.headshot ?? undefined,
        fullName: match.middleInitial
          ? `${match.firstName} ${match.middleInitial} ${match.lastName}`
          : `${match.firstName} ${match.lastName}`,
        initials: `${match.firstName.charAt(0)}${match.lastName.charAt(0)}`,
        matchType: match.matchType,
        score: match.score,
      }))
    }, [matchingClientsQuery.data?.matches])

    const handleSelectClient = useCallback(
      (client: SimpleClient) => {
        form.setFieldValue('client.id', client.id)
        form.setFieldValue('client.firstName', client.firstName)
        form.setFieldValue('client.lastName', client.lastName)
        form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
        form.setFieldValue('client.email', client.email)
        form.setFieldValue('client.dob', client.dob ?? null)
        form.setFieldValue('client.headshot', client.headshot ?? null)
      },
      [form],
    )

    // Auto-select high-confidence matches
    useEffect(() => {
      // Only auto-select once and if no client is already selected
      if (hasAutoSelected.current || selectedClient.id || !suggestedMatches.length) {
        return
      }

      const topMatch = suggestedMatches[0]

      // Auto-select if:
      // 1. Exact match (matchType === 'exact'), OR
      // 2. High-confidence fuzzy match (score >= 0.85 / 85%)
      const shouldAutoSelect =
        topMatch.matchType === 'exact' || (topMatch.matchType === 'fuzzy' && (topMatch.score ?? 0) >= 0.85)

      if (shouldAutoSelect) {
        handleSelectClient(topMatch)
        hasAutoSelected.current = true
      }
    }, [suggestedMatches, selectedClient.id, handleSelectClient])

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
            errors={idField.state.meta.errors.map((e) => e?.message || 'Validation error')}
            returnToWorkflow="instant-test"
            onRegisterNewClient={handleRegisterNewClient}
            suggestedMatches={suggestedMatches}
            donorName={donorName}
            isLoading={matchingClientsQuery.isLoading}
          />
        )}
      </form.AppField>
    )
  },
})

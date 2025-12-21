'use client'

import React, { useState, useEffect } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RefreshCw } from 'lucide-react'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { MedicationList } from '../medication-components/MedicationList'
import { adminGetClientMedicationsAction } from '../actions/adminMedicationActions'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { Button } from '@/components/ui/button'
import { WizardSection } from '../components/WizardSection'
import { WizardCard } from '../components/WizardCard'
import { WizardSectionHeader } from '../components/WizardSectionHeader'
import { ClientInfoCard } from '../components/ClientInfoCard'
import { EmptyState } from '../components/EmptyState'

// Export the schema for reuse in step validation
export const verifyMedicationsFieldSchema = z.object({
  verified: z.boolean().default(true),
  medications: z.array(z.any()).default([]), // Array of medications to be saved at the end
})

const defaultValues: PdfUploadFormType['medicationsData'] = {
  verified: true,
  medications: [],
}

export const BaseVerifyMedicationsFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Medications',
    description: "Review and update the client's medications for accurate drug test interpretation",
  },

  render: function Render({ group, title, description }) {
    // Get form values to access client data
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const client = formValues?.clientData

    // Get medications from form state
    const medications = useStore(group.store, (state) => state.values.medications || [])

    // State for loading initial medications
    const [isLoading, setIsLoading] = useState(true)
    const [initialFetchDone, setInitialFetchDone] = useState(false)

    // Fetch medications on mount and store in form state
    useEffect(() => {
      if (!client?.id || initialFetchDone) {
        setIsLoading(false)
        return
      }

      const fetchMedications = async () => {
        setIsLoading(true)
        try {
          const result = await adminGetClientMedicationsAction(client.id)
          if (result.success) {
            // Store medications in form state
            group.setFieldValue('medications', result.medications)
          }
        } catch (error) {
          console.error('Error fetching medications:', error)
        } finally {
          setIsLoading(false)
          setInitialFetchDone(true)
        }
      }

      fetchMedications()
    }, [client?.id, initialFetchDone, group])

    const handleRefresh = () => {
      setInitialFetchDone(false)
    }

    if (!client) {
      return (
        <WizardSection>
          <FieldGroupHeader title={title} description={description} />
          <EmptyState message="No client selected. Please go back and select a client." />
        </WizardSection>
      )
    }

    return (
      <WizardSection>
        <FieldGroupHeader title={title} description={description} />

        {/* Client Info Card */}
        <ClientInfoCard client={client} size="lg" />

        {/* Medications Section */}
        <WizardCard>
          <WizardSectionHeader
            title="Medications"
            description="Manage medications for accurate drug test interpretation"
            action={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground p-2 transition-colors"
                title="Refresh medications"
              >
                <RefreshCw className="size-5" />
              </Button>
            }
          />

          {isLoading ? (
            <div className="text-muted-foreground py-8 text-center">
              <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin" />
              <p className="text-lg">Loading medications...</p>
            </div>
          ) : (
            <group.AppField name="medications" mode="array">
              {(field) => {
                // Filter to only show active medications
                const activeMedications = field.state.value.filter(
                  (med: any) => med.status === 'active',
                )
                const allMedications = field.state.value

                return (
                  <MedicationList
                    field={field}
                    activeMedications={activeMedications}
                    allMedications={allMedications}
                  />
                )
              }}
            </group.AppField>
          )}
        </WizardCard>
      </WizardSection>
    )
  },
})

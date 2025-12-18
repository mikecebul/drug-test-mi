'use client'

import React, { useState, useEffect } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, RefreshCw } from 'lucide-react'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { MedicationList } from '../medication-components/MedicationList'
import { adminGetClientMedicationsAction } from '../actions/adminMedicationActions'
import type { Medication } from '@/app/dashboard/medications/types'

// Export the schema for reuse in step validation
export const verifyMedicationsFieldSchema = z.object({
  verified: z.boolean().default(true),
  medications: z.array(z.any()).default([]), // Array of medications to be saved at the end
})

const defaultValues: PdfUploadFormType['medicationsData'] = {
  verified: true,
  medications: [],
}

export const VerifyMedicationsFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Medications',
    description: 'Review and update the client\'s medications for accurate drug test interpretation',
  },

  render: function Render({ group, title, description = '' }) {
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
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No client selected. Please go back and select a client.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {/* Client Info Card */}
        <div className="bg-card border-border w-full rounded-xl border p-6 shadow-md">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full">
                <User className="text-primary h-4 w-4" />
              </div>
              <h3 className="text-foreground text-xl font-semibold">Client</h3>
            </div>
          </div>

          {/* Client Info */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage
                src={client.headshot ?? undefined}
                alt={`${client.firstName} ${client.lastName}`}
              />
              <AvatarFallback className="text-lg">
                {client.firstName?.charAt(0)}
                {client.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <p className="text-foreground text-lg font-semibold">
                {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
                {client.lastName}
              </p>
              <p className="text-muted-foreground text-sm">{client.email}</p>
              {client.dob && (
                <p className="text-muted-foreground text-sm">
                  DOB: {new Date(client.dob).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Medications Section */}
        <Card className="shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg font-semibold">Medications</h3>
                <p className="text-muted-foreground text-sm">
                  Manage medications for accurate drug test interpretation
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground transition-colors p-2"
                title="Refresh medications"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading medications...</p>
              </div>
            ) : (
              <group.AppField name="medications" mode="array">
                {(field) => {
                  // Filter to only show active medications
                  const activeMedications = field.state.value.filter(
                    (med: any) => med.status === 'active'
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
          </CardContent>
        </Card>
      </div>
    )
  },
})

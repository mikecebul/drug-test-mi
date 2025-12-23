'use client'

import React, { useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDismissModal } from '@/components/ui/dialog'
import { Check, UserPlus } from 'lucide-react'
import { useGetClientsQuery } from '../../queries'
import { wizardContainerStyles } from '../../styles'
import { testWorkflowFormOpts } from '../../workflows/TestWorkflow/shared-form'
import { ClientDisplayCard } from '../../field-groups/VerifyClient/ClientDisplayCard'
import { SearchDialog } from '../../field-groups/VerifyClient/SearchDialog'
import { FormValues } from './validators'

// Export the schema for reuse in step validation

const defaultValues: FormValues['clientData'] = {
  id: '',
  firstName: '',
  lastName: '',
  middleInitial: null,
  email: '',
  dob: null,
  headshot: null,
}

export const VerifyClientFieldGroup = withForm({
  ...testWorkflowFormOpts,

  props: {
    title: 'Verify Client',
  },

  render: function Render({ form, title }) {
    const [open, setOpen] = useState(false)
    const [showRegisterDialog, setShowRegisterDialog] = useState(false)

    // Get selected client ID and data from form state
    const selectedClientId = useStore(form.store, (state) => state.values.clientData.id)
    const selectedClientData = useStore(form.store, (state) => state.values.clientData)

    // Query for all clients (only enabled when needed)
    const { data: clients } = useGetClientsQuery()

    const { dismiss } = useDismissModal()

    const handleSelectClient = (client: any) => {
      console.log('Client:', client)
      form.setFieldValue('clientData.id', client.id)
      form.setFieldValue('clientData.firstName', client.firstName)
      form.setFieldValue('clientData.lastName', client.lastName)
      form.setFieldValue('clientData.middleInitial', client.middleInitial ?? null)
      form.setFieldValue('clientData.email', client.email)
      form.setFieldValue('clientData.dob', client.dob ?? null)
      form.setFieldValue('clientData.headshot', client.headshot ?? null)
      try {
        dismiss()
      } catch (e) {
        console.log('No active modal to dismiss')
      }
    }

    return (
      <div className={wizardContainerStyles.content}>
        <form.AppField name="clientData.id">
          {(idField) => (
            <div className="space-y-6">
              {/* STATE 1: Confirming Selection */}
              {selectedClientId && (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3">
                  <h4 className="text-muted-foreground px-1 text-sm font-medium">
                    Selected Client
                  </h4>
                  <ClientDisplayCard
                    client={selectedClientData}
                    selected={true}
                    onClick={() => form.setFieldValue('clientData.id', '')}
                  />
                </div>
              )}

              {/* Actions: Always available */}
              <div className="flex flex-col justify-start gap-6 pt-4 sm:flex-row">
                <SearchDialog
                  allClients={clients}
                  selectedClientId={selectedClientId}
                  onSelect={handleSelectClient}
                >
                  <Button size="xl" variant="default">
                    <Check className="size-5" />
                    {selectedClientId ? 'Change Client' : 'Search All Clients'}
                  </Button>
                </SearchDialog>
                <Button
                  size="xl"
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRegisterDialog(true)}
                >
                  <UserPlus className="size-5" />
                  Register New Client
                </Button>
              </div>
              {/* Error Message */}
              {idField.state.meta.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>{idField.state.meta.errors[0]?.message}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </form.AppField>
      </div>
    )
  },
})

'use client'

import React, { use, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDismissModal } from '@/components/ui/dialog'
import { Check, UserPlus } from 'lucide-react'
import { collectLabFormOpts } from '../shared-form'
import { useQuery } from '@tanstack/react-query'
import { getClients, SimpleClient } from '../queries/getClients'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { ClientDisplayCard } from '../components/ClientDisplayCard'
import { SearchDialog } from '../components/SearchDialog'

export const ClientGroup = withForm({
  ...collectLabFormOpts,
  props: {
    title: 'Choose a Client',
  },

  render: function Render({ form, title }) {
    const [open, setOpen] = useState(false)
    const [showRegisterDialog, setShowRegisterDialog] = useState(false)

    // Get selected client ID and data from form state
    const selectedClientId = useStore(form.store, (state) => state.values.client.id)
    const selectedclient = useStore(form.store, (state) => state.values.client)

    // Query for all clients (only enabled when needed)
    const { data: clients } = useQuery({
      queryKey: ['clients'],
      queryFn: getClients,
      staleTime: 30 * 1000, // 30 seconds - clients can be added/deleted frequently
    })

    const { dismiss } = useDismissModal()

    const handleSelectClient = (client: SimpleClient) => {
      form.setFieldValue('client.id', client.id)
      form.setFieldValue('client.firstName', client.firstName)
      form.setFieldValue('client.lastName', client.lastName)
      form.setFieldValue('client.middleInitial', client.middleInitial ?? null)
      form.setFieldValue('client.email', client.email)
      form.setFieldValue('client.dob', client.dob ?? null)
      form.setFieldValue('client.headshot', client.headshot ?? null)
      try {
        dismiss()
      } catch (e) {
        console.log('No active modal to dismiss')
      }
    }

    return (
      <div>
        <FieldGroupHeader title={title} />
        <form.AppField name="client.id">
          {(idField) => (
            <div className="space-y-6">
              {/* STATE 1: Confirming Selection */}
              {selectedClientId && (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3">
                  <h4 className="text-muted-foreground px-1 text-sm font-medium">
                    Selected Client
                  </h4>
                  <ClientDisplayCard
                    client={selectedclient}
                    selected={true}
                    onClick={() => form.setFieldValue('client.id', '')}
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

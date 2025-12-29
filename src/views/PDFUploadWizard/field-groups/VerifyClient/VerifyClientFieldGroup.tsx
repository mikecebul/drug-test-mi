'use client'

import React, { useMemo, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDismissModal } from '@/components/ui/dialog'
import { Loader2, Check, UserPlus } from 'lucide-react'
import type { WizardType } from '../../types'
import { z } from 'zod'
import type { PdfUploadFormType } from '../../schemas/pdfUploadSchemas'
import { useFindMatchingClientsQuery, useGetAllClientsQuery, useExtractPdfQuery } from '../../queries'
import { FieldGroupHeader } from '../../workflows/components/FieldGroupHeader'
import { wizardContainerStyles } from '../../styles'
import { cn } from '@/utilities/cn'
import { ClientDisplayCard } from './ClientDisplayCard'
import { SearchDialog } from './SearchDialog'
import { testWorkflowFormOpts } from '../../workflows/collect-lab-workflow/shared-form'

// Export the schema for reuse in step validation
export const verifyClientFieldSchema = z.object({
  id: z.string().min(1, 'Please select a client'),
  firstName: z.string(),
  lastName: z.string(),
  middleInitial: z.string().nullable(),
  email: z.email(),
  dob: z.string().nullable(),
  headshot: z.string().nullable(),
  matchType: z.enum(['exact', 'fuzzy']),
  score: z.number().optional(),
})

const defaultValues: PdfUploadFormType['clientData'] = {
  id: '',
  firstName: '',
  lastName: '',
  middleInitial: null,
  email: '',
  dob: null,
  headshot: null,
  matchType: 'fuzzy',
  score: 0,
}

export const VerifyClientFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Client',
  },

  render: function Render({ group, title }) {
    const [showAllClients, setShowAllClients] = useState(false)
    const [open, setOpen] = useState(false)
    const [showRegisterDialog, setShowRegisterDialog] = useState(false)

    // Get selected client ID and data from form state
    const selectedClientId = useStore(group.store, (state) => state.values.id)
    const selectedClientData = useStore(group.store, (state) => state.values)

    // Get uploaded file to access extracted data from query cache
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const uploadedFile = formValues?.uploadData?.file as File | null
    const wizardType = formValues?.uploadData?.testType as WizardType

    // Get extracted data from query cache (cached from ExtractFieldGroup)
    const { data: extractedData } = useExtractPdfQuery(uploadedFile, wizardType)
    const donorName = extractedData?.donorName ?? null
    const dob = extractedData?.dob ?? null
    const gender = extractedData?.gender ?? null

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

    // Query for all clients (only enabled when needed)
    const allClientsQuery = useGetAllClientsQuery(showAllClients)

    // Determine if we should show all clients
    const shouldShowAllClients =
      !firstName || !lastName || (matchingClientsQuery.data?.matches.length === 0 && !matchingClientsQuery.isLoading)

    // Auto-enable all clients view if no matches found
    if (shouldShowAllClients && !showAllClients && !matchingClientsQuery.isLoading) {
      setShowAllClients(true)
    }

    const matches = matchingClientsQuery.data?.matches ?? []
    const allClients = allClientsQuery.data?.clients ?? []
    const loading = matchingClientsQuery.isLoading

    // const handleSelectClient = (client: ClientMatch | any) => {
    //   group.setFieldValue('id', client.id)
    //   group.setFieldValue('firstName', client.firstName)
    //   group.setFieldValue('lastName', client.lastName)
    //   group.setFieldValue('middleInitial', client.middleInitial ?? null)
    //   group.setFieldValue('email', client.email)
    //   group.setFieldValue('dob', client.dob ?? null)
    //   group.setFieldValue('headshot', client.headshot ?? null)
    //   group.setFieldValue('matchType', client.matchType || 'exact')
    //   group.setFieldValue('score', client.score || 0)
    //   setOpen(false) // Close dialog if open
    // }

    const { dismiss } = useDismissModal()

    const handleSelectClient = (client: any) => {
      // 1. Update all form fields at once
      const fields = ['id', 'firstName', 'lastName', 'middleInitial', 'email', 'dob', 'headshot', 'matchType', 'score']
      fields.forEach((field) => {
        group.setFieldValue(field as any, (client as any)[field] ?? (field === 'score' ? 0 : null))
      })
      try {
        dismiss()
      } catch (e) {
        console.log('No active modal to dismiss')
      }
    }

    if (loading) {
      return (
        <div className={wizardContainerStyles.content}>
          <FieldGroupHeader
            title="Searching for Client..."
            description={donorName ? `Looking for: ${donorName}` : 'Searching client database'}
          />
          <Card className={wizardContainerStyles.card}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="space-y-4 text-center">
                  <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                  <p className="text-muted-foreground text-lg">Please wait while we search for matches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader
          title={title}
          description={donorName ? `Select the correct client for: ${donorName}` : 'Search for the client manually'}
        />
        <group.AppField name="id">
          {(idField) => (
            <div className={cn(wizardContainerStyles.fields, 'space-y-6')}>
              {/* STATE 1: Confirming Selection */}
              {selectedClientId ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3">
                  <h4 className="text-muted-foreground px-1 text-sm font-medium">Selected Client</h4>
                  <ClientDisplayCard
                    client={selectedClientData}
                    selected={true}
                    onClick={() => group.setFieldValue('id', '')} // Toggle off to change
                  />
                </div>
              ) : (
                /* STATE 2: Suggestions Available */
                matches.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-muted-foreground px-1 text-sm font-medium">Suggested Matches</h4>
                    {matches.map((match) => (
                      <ClientDisplayCard key={match.id} client={match} onClick={() => handleSelectClient(match)} />
                    ))}
                  </div>
                )
              )}

              {/* Actions: Always available */}
              <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
                <SearchDialog allClients={allClients} selectedClientId={selectedClientId} onSelect={handleSelectClient}>
                  <Button type="button" variant="outline">
                    <Check className="mr-2 h-4 w-4" />
                    {selectedClientId ? 'Change Client' : 'Search All Clients'}
                  </Button>
                </SearchDialog>
                <Button type="button" variant="secondary" onClick={() => setShowRegisterDialog(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register New Client
                </Button>
              </div>
              {/* Error Message */}
              {idField.state.meta.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>{idField.state.meta.errors[0]}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </group.AppField>
      </div>
    )
  },
})

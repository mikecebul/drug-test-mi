'use client'

import React, { useMemo, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Loader2, AlertCircle, UserCheck, Mail, CheckCircle2, Check } from 'lucide-react'
import type { ClientMatch } from '../types'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { useFindMatchingClientsQuery, useGetAllClientsQuery, useExtractPdfQuery } from '../queries'
import ShadcnWrapper from '@/components/ShadcnWrapper'

// Export the schema for reuse in step validation
export const verifyClientFieldSchema = z.object({
  id: z.string().min(1, 'Please select a client'),
  firstName: z.string(),
  lastName: z.string(),
  middleInitial: z.string().nullable(),
  email: z.string().email(),
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

    // Get selected client ID and data from form state
    const selectedClientId = useStore(group.store, (state) => state.values.id)
    const selectedClientData = useStore(group.store, (state) => state.values)

    // Get uploaded file to access extracted data from query cache
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const uploadedFile = formValues?.uploadData?.file as File | null
    const testType = formValues?.uploadData?.testType as
      | '15-panel-instant'
      | '11-panel-lab'
      | '17-panel-sos-lab'
      | 'etg-lab'
      | undefined

    // Get extracted data from query cache (cached from ExtractFieldGroup)
    const { data: extractedData } = useExtractPdfQuery(uploadedFile, testType)
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

    // Query for all clients (only enabled when needed)
    const allClientsQuery = useGetAllClientsQuery(showAllClients)

    // Determine if we should show all clients
    const shouldShowAllClients =
      !firstName ||
      !lastName ||
      (matchingClientsQuery.data?.matches.length === 0 && !matchingClientsQuery.isLoading)

    // Auto-enable all clients view if no matches found
    if (shouldShowAllClients && !showAllClients && !matchingClientsQuery.isLoading) {
      setShowAllClients(true)
    }

    const matches = matchingClientsQuery.data?.matches ?? []
    const allClients = allClientsQuery.data?.clients ?? []
    const loading = matchingClientsQuery.isLoading

    if (loading) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">Searching for Client...</h2>
            <p className="text-muted-foreground">
              {donorName ? `Looking for: ${donorName}` : 'Searching client database'}
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="space-y-4 text-center">
                  <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                  <p className="text-muted-foreground">Please wait while we search for matches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">
            {donorName
              ? `Select the correct client for: ${donorName}`
              : 'Search for the client manually'}
          </p>
        </div>

        {matches.length === 0 && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="space-y-3">
              <p className="text-blue-900 dark:text-blue-100">
                {donorName
                  ? `No matches found for "${donorName}".`
                  : 'Unable to extract client name from PDF.'}{' '}
                Please search for the correct client manually.
              </p>
              <div>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    setShowAllClients(true)
                    setOpen(true)
                  }}
                >
                  Search All Clients
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <group.AppField
          name="id"
          validators={{
            onChange: ({ value }) => {
              if (!value || value === '') {
                return 'Please select a client'
              }
              return undefined
            },
          }}
        >
          {(idField) => (
            <div className="space-y-4">
              {matches.length > 0 && (
                <>
                  <div className="space-y-3">
                    {matches.map((match) => (
                      <Card
                        key={match.id}
                        className={`hover:border-primary cursor-pointer transition-colors ${
                          selectedClientId === match.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => {
                          // Update all client fields
                          group.setFieldValue('id', match.id)
                          group.setFieldValue('firstName', match.firstName)
                          group.setFieldValue('lastName', match.lastName)
                          group.setFieldValue('middleInitial', match.middleInitial ?? null)
                          group.setFieldValue('email', match.email)
                          group.setFieldValue('dob', match.dob ?? null)
                          group.setFieldValue('headshot', match.headshot ?? null)
                          group.setFieldValue('matchType', match.matchType)
                          group.setFieldValue('score', match.score || 0)
                        }}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <Avatar className="h-14 w-14 shrink-0">
                              <AvatarImage
                                src={match.headshot ?? undefined}
                                alt={`${match.firstName} ${match.lastName}`}
                              />
                              <AvatarFallback className="text-lg">
                                {match.firstName.charAt(0)}
                                {match.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="text-muted-foreground h-5 w-5" />
                                    <p className="text-lg font-semibold">
                                      {match.firstName}{' '}
                                      {match.middleInitial ? `${match.middleInitial}. ` : ''}
                                      {match.lastName}
                                    </p>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <Mail className="text-muted-foreground h-4 w-4" />
                                    <p className="text-muted-foreground text-sm">{match.email}</p>
                                  </div>
                                </div>
                                {match.matchType === 'exact' ? (
                                  <Badge variant="default" className="bg-green-600">
                                    Exact Match
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    {Math.round((match.score || 0) * 100)}% Match
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                // The card's onClick will handle the selection
                              }}
                              size="sm"
                            >
                              Select
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAllClients(true)
                        setOpen(true)
                      }}
                    >
                      {selectedClientId
                        ? 'Change selected client'
                        : 'Not the right client? Search all clients'}
                    </Button>
                  </div>
                </>
              )}

              {/* Client Search Dialog */}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl p-0">
                  <ShadcnWrapper className="origin-top scale-125">
                    <DialogTitle className="sr-only">Search and Select Client</DialogTitle>
                    <Command className="">
                      <CommandInput placeholder="Search by name or email..." />
                      <CommandList>
                        <CommandEmpty>
                          {allClients.length === 0 ? 'Loading clients...' : 'No client found.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {allClients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={`${client.firstName} ${client.middleInitial || ''} ${client.lastName} ${client.email}`}
                              className="px-3 py-3"
                              onSelect={() => {
                                group.setFieldValue('id', client.id)
                                group.setFieldValue('firstName', client.firstName)
                                group.setFieldValue('lastName', client.lastName)
                                group.setFieldValue('middleInitial', client.middleInitial ?? null)
                                group.setFieldValue('email', client.email)
                                group.setFieldValue('dob', client.dob ?? null)
                                group.setFieldValue('headshot', client.headshot ?? null)
                                group.setFieldValue('matchType', client.matchType)
                                group.setFieldValue('score', client.score || 0)
                                setOpen(false)
                              }}
                            >
                              <Check
                                className={`mr-3 h-5 w-5 shrink-0 ${
                                  selectedClientId === client.id ? 'opacity-100' : 'opacity-0'
                                }`}
                              />
                              <Avatar className="mr-3 h-10 w-10 shrink-0">
                                <AvatarImage
                                  src={client.headshot ?? undefined}
                                  alt={`${client.firstName} ${client.lastName}`}
                                />
                                <AvatarFallback className="text-sm">
                                  {client.firstName.charAt(0)}
                                  {client.lastName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-base font-medium">
                                  {client.firstName}{' '}
                                  {client.middleInitial ? `${client.middleInitial}. ` : ''}
                                  {client.lastName}
                                </span>
                                <span className="text-muted-foreground text-sm">
                                  {client.email}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </ShadcnWrapper>
                </DialogContent>
              </Dialog>

              {/* Selected Client Confirmation */}
              {selectedClientId && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 shrink-0 border-2 border-green-300 dark:border-green-700">
                      <AvatarImage
                        src={selectedClientData.headshot ?? undefined}
                        alt={`${selectedClientData.firstName} ${selectedClientData.lastName}`}
                      />
                      <AvatarFallback className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {selectedClientData.firstName.charAt(0)}
                        {selectedClientData.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Client Selected
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                        {selectedClientData.firstName}{' '}
                        {selectedClientData.middleInitial
                          ? `${selectedClientData.middleInitial}. `
                          : ''}
                        {selectedClientData.lastName} ({selectedClientData.email})
                      </p>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Validation Error */}
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

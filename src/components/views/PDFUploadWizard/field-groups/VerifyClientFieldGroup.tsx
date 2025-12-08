'use client'

import React, { useMemo, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Loader2,
  AlertCircle,
  UserCheck,
  Mail,
  CheckCircle2,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import type { ClientMatch } from '../types'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { useFindMatchingClientsQuery, useGetAllClientsQuery, useExtractPdfQuery } from '../queries'

// Export the schema for reuse in step validation
export const verifyClientFieldSchema = z.object({
  id: z.string().min(1, 'Please select a client'),
  firstName: z.string(),
  lastName: z.string(),
  middleInitial: z.string().nullable(),
  email: z.string().email(),
  dob: z.string().nullable(),
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
      !firstName || !lastName || (matchingClientsQuery.data?.matches.length === 0 && !matchingClientsQuery.isLoading)

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

        {matches.length === 0 && donorName && showAllClients && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription>
              <p className="text-blue-900 dark:text-blue-100">
                No matches found for &quot;{donorName}&quot;. Please select the correct client from
                the dropdown below.
              </p>
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
                          group.setFieldValue('matchType', match.matchType)
                          group.setFieldValue('score', match.score || 0)
                        }}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
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

                  {!showAllClients && (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAllClients(true)}
                      >
                        Not the right client? Search all clients
                      </Button>
                    </div>
                  )}
                </>
              )}

              {(showAllClients || matches.length === 0) && (
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <Label htmlFor="client-select">Search and Select Client</Label>
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="client-select"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between"
                          >
                            {selectedClientId ? (
                              <>
                                {selectedClientData.firstName}{' '}
                                {selectedClientData.middleInitial
                                  ? `${selectedClientData.middleInitial}. `
                                  : ''}
                                {selectedClientData.lastName} - {selectedClientData.email}
                              </>
                            ) : (
                              'Search for a client...'
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="" align="start">
                          <Command>
                            <CommandInput placeholder="Search by name or email..." />
                            <CommandList>
                              <CommandEmpty>
                                {allClients.length === 0
                                  ? 'Loading clients...'
                                  : 'No client found.'}
                              </CommandEmpty>
                              <CommandGroup>
                                {allClients.map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    value={`${client.firstName} ${client.middleInitial || ''} ${client.lastName} ${client.email}`}
                                    onSelect={() => {
                                      group.setFieldValue('id', client.id)
                                      group.setFieldValue('firstName', client.firstName)
                                      group.setFieldValue('lastName', client.lastName)
                                      group.setFieldValue(
                                        'middleInitial',
                                        client.middleInitial ?? null,
                                      )
                                      group.setFieldValue('email', client.email)
                                      group.setFieldValue('dob', client.dob ?? null)
                                      group.setFieldValue('matchType', client.matchType)
                                      group.setFieldValue('score', client.score || 0)
                                      setOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        selectedClientId === client.id ? 'opacity-100' : 'opacity-0'
                                      }`}
                                    />
                                    <div className="flex flex-col">
                                      <span>
                                        {client.firstName}{' '}
                                        {client.middleInitial ? `${client.middleInitial}. ` : ''}
                                        {client.lastName}
                                      </span>
                                      <span className="text-muted-foreground text-xs">
                                        {client.email}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Selected Client Confirmation */}
              {selectedClientId && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription>
                    <p className="mb-1 font-medium text-green-900 dark:text-green-100">
                      Client Selected
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {selectedClientData.firstName}{' '}
                      {selectedClientData.middleInitial
                        ? `${selectedClientData.middleInitial}. `
                        : ''}
                      {selectedClientData.lastName} ({selectedClientData.email})
                    </p>
                  </AlertDescription>
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

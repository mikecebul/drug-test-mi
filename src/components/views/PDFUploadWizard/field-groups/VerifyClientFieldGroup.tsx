'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, UserCheck, Mail, CheckCircle2 } from 'lucide-react'
import { findMatchingClients, getAllClients } from '../actions'
import type { ClientMatch } from '../types'

const defaultValues = {
  id: '',
  firstName: '',
  lastName: '',
  middleInitial: null as string | null,
  email: '',
  dob: null as string | null,
  matchType: 'fuzzy' as 'exact' | 'fuzzy',
  score: 0,
}

export const VerifyClientFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Client',
  },

  render: function Render({ group, title }) {
    const [loading, setLoading] = useState(true)
    const [matches, setMatches] = useState<ClientMatch[]>([])
    const [allClients, setAllClients] = useState<ClientMatch[]>([])
    const [showAllClients, setShowAllClients] = useState(false)

    // Get selected client ID and data from form state
    const selectedClientId = useStore(group.store, (state) => state.values.id)
    const selectedClientData = useStore(group.store, (state) => state.values)

    // Get extracted donor name
    const formValues = useStore(group.form.store, (state) => state.values)
    const donorName = (formValues as any).extractData?.donorName as string | null

    useEffect(() => {
      async function searchForClient() {
        if (!donorName) {
          setLoading(false)
          setShowAllClients(true)
          return
        }

        // Parse name into parts
        const nameParts = donorName.split(/\s+/)
        if (nameParts.length < 2) {
          setLoading(false)
          setShowAllClients(true)
          return
        }

        const firstName = nameParts[0]
        const lastName = nameParts[nameParts.length - 1]
        const middleInitial = nameParts.length === 3 ? nameParts[1].charAt(0) : undefined

        const result = await findMatchingClients(firstName, lastName, middleInitial)
        setMatches(result.matches)
        setLoading(false)

        if (result.matches.length === 0) {
          setShowAllClients(true)
        }
      }

      searchForClient()
    }, [donorName])

    useEffect(() => {
      if (showAllClients && allClients.length === 0) {
        loadAllClients()
      }
    }, [showAllClients])

    const loadAllClients = async () => {
      const result = await getAllClients()
      setAllClients(result.clients)
    }

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
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
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
                No matches found for "{donorName}". Please select the correct client from the
                dropdown below.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {matches.length > 0 && (
            <div className="space-y-3">
              {matches.map((match) => (
                <Card
                  key={match.id}
                  className={`cursor-pointer transition-colors hover:border-primary ${
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
                              <UserCheck className="h-5 w-5 text-muted-foreground" />
                              <p className="text-lg font-semibold">
                                {match.firstName}{' '}
                                {match.middleInitial ? `${match.middleInitial}. ` : ''}
                                {match.lastName}
                              </p>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">{match.email}</p>
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
          )}

          {showAllClients && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="client-select">Select Client from All Clients</Label>
                  <Select
                    value={selectedClientId}
                    onValueChange={(clientId) => {
                      const client = allClients.find((c) => c.id === clientId)
                      if (client) {
                        group.setFieldValue('id', client.id)
                        group.setFieldValue('firstName', client.firstName)
                        group.setFieldValue('lastName', client.lastName)
                        group.setFieldValue('middleInitial', client.middleInitial ?? null)
                        group.setFieldValue('email', client.email)
                        group.setFieldValue('dob', client.dob ?? null)
                        group.setFieldValue('matchType', client.matchType)
                        group.setFieldValue('score', client.score || 0)
                      }
                    }}
                  >
                    <SelectTrigger id="client-select">
                      <SelectValue placeholder="Choose a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allClients.length === 0 ? (
                        <SelectItem value="loading" disabled>
                          Loading clients...
                        </SelectItem>
                      ) : (
                        allClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
                            {client.lastName} - {client.email}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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
                  {selectedClientData.middleInitial ? `${selectedClientData.middleInitial}. ` : ''}
                  {selectedClientData.lastName} ({selectedClientData.email})
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    )
  },
})

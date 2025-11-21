'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCheck, Users, Loader2, AlertCircle, Mail, List } from 'lucide-react'
import { findMatchingClients, getAllClients } from '../actions'
import type { ParsedPDFData, ClientMatch } from '../types'

interface VerifyClientStepProps {
  parsedData: ParsedPDFData
  onNext: (client: ClientMatch) => void
  onBack: () => void
}

export function VerifyClientStep({ parsedData, onNext, onBack }: VerifyClientStepProps) {
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<ClientMatch[]>([])
  const [allClients, setAllClients] = useState<ClientMatch[]>([])
  const [showAllClients, setShowAllClients] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>('')

  useEffect(() => {
    async function searchForClient() {
      if (!parsedData.donorName) {
        setLoading(false)
        setShowAllClients(true)
        return
      }

      // Parse name into parts
      const nameParts = parsedData.donorName.split(/\s+/)
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
  }, [parsedData])

  useEffect(() => {
    if (showAllClients && allClients.length === 0) {
      loadAllClients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllClients])

  const loadAllClients = async () => {
    const result = await getAllClients()
    setAllClients(result.clients)
  }

  const handleShowAllClients = () => {
    setShowAllClients(true)
  }

  const handleSelectFromDropdown = () => {
    if (!selectedClientId) return
    const client = allClients.find((c) => c.id === selectedClientId)
    if (client) {
      onNext(client)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Searching for Client...</h2>
          <p className="text-muted-foreground">
            {parsedData.donorName
              ? `Looking for: ${parsedData.donorName}`
              : 'Searching client database'}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
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
        <h2 className="text-2xl font-bold mb-2">Verify Client</h2>
        <p className="text-muted-foreground">
          {parsedData.donorName
            ? `Select the correct client for: ${parsedData.donorName}`
            : 'Search for the client manually'}
        </p>
      </div>

      {matches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              Found {matches.length} match{matches.length > 1 ? 'es' : ''}
            </h3>
          </div>
          <div className="space-y-3">
            {matches.map((match) => (
              <Card
                key={match.id}
                className="hover:border-primary transition-colors cursor-pointer group"
                onClick={() => onNext(match)}
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
                          <div className="flex items-center gap-2 mt-1">
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
                      onClick={(e) => {
                        e.stopPropagation()
                        onNext(match)
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
        </div>
      )}

      {showAllClients && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {matches.length === 0 && parsedData.donorName && (
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription>
                  <p className="text-blue-900 dark:text-blue-100">
                    No matches found for "{parsedData.donorName}". Please select the correct client
                    from the dropdown below.
                  </p>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="client-select" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Select Client from All Clients
              </Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
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
            <Button
              onClick={handleSelectFromDropdown}
              disabled={!selectedClientId}
              className="w-full"
            >
              Select Client
            </Button>
          </CardContent>
        </Card>
      )}

      {!showAllClients && matches.length > 0 && (
        <Button onClick={handleShowAllClients} variant="outline" className="w-full">
          <List className="h-4 w-4 mr-2" />
          Or Select from All Clients
        </Button>
      )}

      <div className="flex justify-start pt-6">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
      </div>
    </div>
  )
}

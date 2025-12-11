'use client'

import React from 'react'
import { useFieldContext } from '../hooks/form-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCheck, Mail } from 'lucide-react'
import type { ClientMatch } from '@/components/views/PDFUploadWizard/types'

interface ClientSelectorFieldProps {
  matches: ClientMatch[]
  allClients: ClientMatch[]
  showAllClients: boolean
  onShowAllClients: () => void
  label?: string
  required?: boolean
}

export default function ClientSelectorField({
  matches,
  allClients,
  showAllClients,
  onShowAllClients,
  label = 'Select Client',
  required = false,
}: ClientSelectorFieldProps) {
  const field = useFieldContext<ClientMatch | null>()
  const [selectedClientId, setSelectedClientId] = React.useState<string>('')

  const handleSelectFromDropdown = () => {
    if (!selectedClientId) return
    const client = allClients.find((c) => c.id === selectedClientId)
    if (client) {
      field.handleChange(client)
    }
  }

  return (
    <div className="space-y-4">
      {label && (
        <Label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {matches.length > 0 && (
        <div className="space-y-3">
          {matches.map((match) => (
            <Card
              key={match.id}
              className={`cursor-pointer transition-colors hover:border-primary ${
                field.state.value?.id === match.id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => field.handleChange(match)}
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
                      field.handleChange(match)
                    }}
                    size="sm"
                    variant={field.state.value?.id === match.id ? 'default' : 'outline'}
                  >
                    {field.state.value?.id === match.id ? 'Selected' : 'Select'}
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
              <Label htmlFor="client-select" className="flex items-center gap-2">
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
              type="button"
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
        <Button type="button" onClick={onShowAllClients} variant="outline" className="w-full">
          Or Select from All Clients
        </Button>
      )}

      {field.state.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">{String(field.state.meta.errors[0])}</p>
      )}
    </div>
  )
}

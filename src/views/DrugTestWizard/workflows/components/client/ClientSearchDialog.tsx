'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SimpleClient } from './getClients'
import { CLIENT_SEARCH_MIN_CHARS, searchClients } from './clientSearch'

export const ClientSearchDialog = ({
  allClients,
  children,
  selectedClientId,
  onSelect,
}: {
  allClients?: SimpleClient[]
  children: React.ReactNode
  selectedClientId: string
  onSelect: (client: SimpleClient) => void
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim()

  const results = useMemo(() => searchClients(allClients, trimmedQuery), [allClients, trimmedQuery])
  const showingRecent = trimmedQuery.length < CLIENT_SEARCH_MIN_CHARS

  const emptyMessage = !allClients
    ? showingRecent
      ? 'Loading recent clients...'
      : 'Searching clients...'
    : showingRecent
      ? 'No recent clients found.'
      : 'No client found.'

  const groupLabel = showingRecent ? 'Recent Clients' : 'Search Results'

  return (
    <CommandDialog title="Search and Select Client" trigger={children} commandProps={{ shouldFilter: false }}>
      <CommandInput
        value={searchQuery}
        onValueChange={setSearchQuery}
        placeholder="Search by name, DOB, phone, or email..."
        className="h-14 text-lg"
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup heading={groupLabel}>
          {results.map((client) => {
            return (
              <CommandItem
                key={client.id}
                value={client.id}
                className="px-3 py-3 text-lg"
                onSelect={() => onSelect(client)}
              >
                <Check
                  className={`mr-3 size-6 shrink-0 ${selectedClientId === client.id ? 'opacity-100' : 'opacity-0'}`}
                />
                <Avatar className="mr-3 size-12 shrink-0">
                  <AvatarImage src={client.headshot} alt={client.fullName} />
                  <AvatarFallback className="text-lg">{client.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex flex-col">
                  <span className="text-lg font-medium">{client.fullName}</span>
                  {client.phone ? (
                    <span className="text-muted-foreground text-sm">{client.phone}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">No phone on file</span>
                  )}
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

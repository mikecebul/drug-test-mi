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
import { Badge } from '@/components/ui/badge'
import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { ClientSearchMatchReason, ClientSearchResult } from '@/collections/Clients/search/types'
import { getClientById, type SimpleClient } from './getClients'
import { CLIENT_SEARCH_MIN_CHARS } from './clientSearch'
import { useClientSearch } from './useClientSearch'

function formatDob(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value
}

function getMatchLabel(result: ClientSearchResult) {
  if (result.matchReason === 'recent') return 'Recently updated'

  const reasonLabels: Record<ClientSearchMatchReason, string> = {
    email: 'email',
    phone: 'phone',
    'date-of-birth': 'date of birth',
    name: 'name',
    recent: 'recent',
  }

  if (result.matchType === 'exact') return `Exact ${reasonLabels[result.matchReason]}`
  if (result.matchType === 'partial') return `Partial ${reasonLabels[result.matchReason]}`
  return `Possible ${reasonLabels[result.matchReason]} match`
}

export const ClientSearchDialog = ({
  children,
  selectedClientId,
  onSelect,
}: {
  children: React.ReactNode
  selectedClientId: string
  onSelect: (client: SimpleClient) => void
}) => {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectingClientId, setSelectingClientId] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const trimmedQuery = searchQuery.trim()
  const showingRecent = trimmedQuery.length === 0
  const searchQueryState = useClientSearch(
    showingRecent ? { recent: true, limit: 15 } : { query: trimmedQuery, limit: 15 },
    { enabled: open },
  )
  const hideStaleResults = searchQueryState.isDebouncing || searchQueryState.isTooShort
  const exactMatches = hideStaleResults ? [] : (searchQueryState.data?.exactMatches ?? [])
  const possibleMatches = hideStaleResults ? [] : (searchQueryState.data?.possibleMatches ?? [])
  const isSearching = searchQueryState.isFetching || searchQueryState.isDebouncing

  const emptyMessage = searchQueryState.isTooShort
    ? `Enter at least ${CLIENT_SEARCH_MIN_CHARS} characters to search.`
    : isSearching
      ? showingRecent
        ? 'Loading recent clients...'
        : 'Searching clients...'
      : searchQueryState.isError
        ? 'Client search is unavailable. Please try again.'
        : showingRecent
          ? 'No recent clients found.'
          : 'No matching client found.'

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearchQuery('')
      setSelectionError(null)
    }
  }

  const handleSelect = async (result: ClientSearchResult) => {
    setSelectingClientId(result.id)
    setSelectionError(null)

    try {
      const client = await getClientById(result.id)
      if (!client) throw new Error('Client record is no longer available.')
      onSelect(client)
      handleOpenChange(false)
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Unable to select this client.')
    } finally {
      setSelectingClientId(null)
    }
  }

  const renderResult = (client: ClientSearchResult) => (
    <CommandItem
      key={client.id}
      value={client.id}
      className="px-3 py-3 text-lg"
      disabled={Boolean(selectingClientId)}
      onSelect={() => void handleSelect(client)}
    >
      {selectingClientId === client.id ? (
        <Loader2 className="mr-3 size-6 shrink-0 animate-spin" />
      ) : (
        <Check className={`mr-3 size-6 shrink-0 ${selectedClientId === client.id ? 'opacity-100' : 'opacity-0'}`} />
      )}
      <Avatar className="mr-3 size-12 shrink-0">
        <AvatarImage src={client.headshot} alt={client.fullName} />
        <AvatarFallback className="text-lg">{client.initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-medium">{client.fullName}</span>
          <Badge variant={client.matchType === 'exact' ? 'success' : 'secondary'}>{getMatchLabel(client)}</Badge>
        </div>
        <span className="text-muted-foreground block truncate text-sm">{client.email}</span>
        <span className="text-muted-foreground block text-sm">
          {client.phone || 'No phone on file'}
          {client.dob ? ` · DOB ${formatDob(client.dob)}` : ''}
        </span>
      </div>
    </CommandItem>
  )

  return (
    <CommandDialog
      title="Search and Select Client"
      trigger={children}
      commandProps={{ shouldFilter: false }}
      disablePointerDismissal
      open={open}
      onOpenChange={handleOpenChange}
      backdropProps={{
        // Base UI can dismiss on pointer-down. Closing on the completed backdrop
        // click keeps that click from reaching a suggested client behind the dialog.
        onClick: () => handleOpenChange(false),
      }}
    >
      <CommandInput
        value={searchQuery}
        onValueChange={setSearchQuery}
        placeholder="Search by name, DOB, phone, or email..."
        className="h-14 text-lg"
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        {exactMatches.length > 0 && (
          <CommandGroup heading="Exact Matches">{exactMatches.map(renderResult)}</CommandGroup>
        )}
        {possibleMatches.length > 0 && (
          <CommandGroup heading={showingRecent ? 'Recent Clients' : 'Possible Matches'}>
            {possibleMatches.map(renderResult)}
          </CommandGroup>
        )}
        {selectionError && <p className="text-destructive px-4 py-3 text-sm">{selectionError}</p>}
      </CommandList>
    </CommandDialog>
  )
}

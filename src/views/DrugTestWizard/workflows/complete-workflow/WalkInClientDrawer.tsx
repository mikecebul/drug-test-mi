'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronRight, Loader2, UserPlus, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import type { ClientSearchResult } from '@/collections/Clients/search/types'
import { formatDobInput } from '@/lib/date-utils'
import { cn } from '@/utilities/cn'
import { CLIENT_SEARCH_MIN_CHARS } from '../components/client/clientSearch'
import { getClientById, type SimpleClient } from '../components/client/getClients'
import { useClientSearch } from '../components/client/useClientSearch'

interface WalkInClientDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegister: () => void
  onSelect: (client: SimpleClient) => void
  selectedClientId: string
}

export function WalkInClientDrawer({
  open,
  onOpenChange,
  onRegister,
  onSelect,
  selectedClientId,
}: WalkInClientDrawerProps) {
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
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setSearchQuery('')
      setSelectionError(null)
    }
  }

  const handleRegister = () => {
    handleOpenChange(false)
    onRegister()
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

  const renderResult = (client: ClientSearchResult) => {
    const isSelected = selectedClientId === client.id

    return (
      <CommandItem
        key={client.id}
        value={client.id}
        className="rounded-lg px-3 py-3 text-base"
        disabled={Boolean(selectingClientId)}
        onSelect={() => void handleSelect(client)}
      >
        {selectingClientId === client.id ? (
          <Loader2 className="size-5 shrink-0 animate-spin" />
        ) : (
          <Avatar className="size-11">
            <AvatarImage src={client.headshot} alt={client.fullName} />
            <AvatarFallback className="text-base font-medium">{client.initials}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{client.fullName}</p>
          <p className="text-muted-foreground truncate text-sm">{client.email}</p>
          <p className="text-muted-foreground truncate text-sm">
            {client.phone || 'No phone on file'}
            {client.dob ? ` · DOB ${formatDobInput(client.dob)}` : ''}
          </p>
        </div>
        <CheckCircle2
          aria-hidden="true"
          className={cn('ml-auto size-5 shrink-0', isSelected ? 'text-primary opacity-100' : 'opacity-0')}
        />
      </CommandItem>
    )
  }

  return (
    <Drawer swipeDirection="right" open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="data-[swipe-direction=right]:w-[min(512px,calc(100vw-16px))] data-[swipe-direction=right]:sm:max-w-none">
        <DrawerHeader className="border-border border-b">
          <div className="flex items-center justify-between gap-4">
            <DrawerTitle>Choose client</DrawerTitle>
            <DrawerClose render={<Button type="button" variant="ghost" size="icon" aria-label="Close client chooser" />}>
              <X data-icon="inline-start" />
            </DrawerClose>
          </div>
          <DrawerDescription className="sr-only">Search client records or register a new client.</DrawerDescription>
        </DrawerHeader>

        <Command shouldFilter={false} className="bg-background min-h-0 flex-1 rounded-none">
          <div className="flex flex-col gap-4 p-4">
            <div className="border-input rounded-lg border [&_[data-slot=command-input-wrapper]]:border-b-0">
              <CommandInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search by name, DOB, phone, or email..."
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="clear"
              className="h-auto min-h-20 w-full justify-start gap-4 p-4 text-left"
              onClick={handleRegister}
            >
              <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-lg">
                <UserPlus />
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="font-semibold">Register new client</span>
                <span className="text-muted-foreground text-sm font-normal">Create a client record</span>
              </span>
              <ChevronRight className="text-muted-foreground" />
            </Button>
          </div>

          <Separator />

          <CommandList className="max-h-none flex-1 px-4 py-3">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {exactMatches.length > 0 && (
              <CommandGroup heading="Exact matches">{exactMatches.map(renderResult)}</CommandGroup>
            )}
            {possibleMatches.length > 0 && (
              <CommandGroup heading={showingRecent ? 'Recent clients' : 'Possible matches'}>
                {possibleMatches.map(renderResult)}
              </CommandGroup>
            )}
            {selectionError && <p className="text-destructive px-3 py-2 text-sm">{selectionError}</p>}
          </CommandList>
        </Command>
      </DrawerContent>
    </Drawer>
  )
}

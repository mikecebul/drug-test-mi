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
import type { SimpleClient } from './getClients'

export const ClientSearchDialog = ({
  allClients,
  children,
  selectedClientId,
  onSelect,
}: {
  allClients?: SimpleClient[]
  children: React.ReactNode
  selectedClientId: string
  onSelect: (client: any) => void
}) => {
  return (
    <CommandDialog title="Search and Select Client" trigger={children}>
      <CommandInput placeholder="Search by name or email..." className="h-14 text-lg" />
      <CommandList>
        <CommandEmpty>{allClients?.length === 0 ? 'Loading clients...' : 'No client found.'}</CommandEmpty>
        <CommandGroup>
          {allClients?.map((client) => (
            <CommandItem
              key={client.id}
              value={`${client.fullName} ${client.email}`}
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
              <div className="flex flex-col">
                <span className="text-lg font-medium">{client.fullName}</span>
                <span className="text-muted-foreground text-base">{client.email}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

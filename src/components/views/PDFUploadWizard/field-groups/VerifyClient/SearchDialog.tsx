'use client'

import ShadcnWrapper from '@/components/ShadcnWrapper'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Check } from 'lucide-react'

export const SearchDialog = ({
  allClients,
  children,
  selectedClientId,
  onSelect,
}: {
  allClients: any[]
  children: React.ReactNode
  selectedClientId: string
  onSelect: (client: any) => void
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <ShadcnWrapper className="pt-12">
          <DialogTitle className="sr-only">Search and Select Client</DialogTitle>
          <Command className="">
            <CommandInput placeholder="Search by name or email..." className="h-14 text-lg" />
            <CommandList>
              <CommandEmpty>
                {allClients.length === 0 ? 'Loading clients...' : 'No client found.'}
              </CommandEmpty>
              <CommandGroup>
                {allClients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.firstName} ${client.middleInitial || ''} ${client.lastName} ${client.email}`}
                    className="px-3 py-3 text-lg"
                    onSelect={() => onSelect(client)}
                  >
                    <Check
                      className={`mr-3 size-6 shrink-0 ${
                        selectedClientId === client.id ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <Avatar className="mr-3 size-12 shrink-0">
                      <AvatarImage
                        src={client.headshot ?? undefined}
                        alt={`${client.firstName} ${client.lastName}`}
                      />
                      <AvatarFallback className="text-lg">
                        {client.firstName.charAt(0)}
                        {client.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-lg font-medium">
                        {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
                        {client.lastName}
                      </span>
                      <span className="text-muted-foreground text-base">{client.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </ShadcnWrapper>
      </DialogContent>
    </Dialog>
  )
}

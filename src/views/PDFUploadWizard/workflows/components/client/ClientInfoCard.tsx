'use client'

import { formatDateOnly } from '@/lib/date-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/utilities/cn'
import { SimpleClient } from './getClients'

interface ClientInfoCardProps {
  client: SimpleClient
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  return (
    <div
      className={cn(
        'relative w-full rounded-lg border p-6',
        'text-primary bg-info-muted border-info',
        'flex h-full items-center gap-6',
      )}
    >
      {/* Avatar */}
      <Avatar className="size-16 shrink-0 lg:size-24">
        <AvatarImage src={client.headshot ?? undefined} alt={`${client.firstName} ${client.lastName}`} />
        <AvatarFallback className="text-lg">
          {client.firstName?.charAt(0)}
          {client.lastName?.charAt(0)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex flex-1 flex-col space-y-3">
        {/* Name */}
        <h3 className="text-2xl leading-tight font-bold tracking-tight lg:text-3xl">
          {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
          {client.lastName}
        </h3>

        {/* Details */}
        <div className="text-muted-foreground">
          <p>{client.email}</p>
          {client.dob && <p>DOB: {formatDateOnly(client.dob)}</p>}
          {client.phone && <p>Phone: {client.phone}</p>}
        </div>
      </div>
    </div>
  )
}

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/utilities/cn'
import { Mail } from 'lucide-react'
import type { FormClient } from '../../shared-validators'
import type { SimpleClient } from './getClients'

interface ClientDisplayCardProps {
  selected?: boolean
  children: React.ReactNode
  onClick?: () => void
}

interface ClientInfoContentProps {
  client: FormClient | SimpleClient
  className?: string
  showMatchBadge?: boolean
}

// Root component - with Card wrapper
export const ClientDisplayCard = ({ selected, children, onClick }: ClientDisplayCardProps) => (
  <Card
    className={cn('p-6', {
      'border-info bg-info-muted shadow-sm': selected,
      'cursor-pointer transition-colors hover:border-info hover:bg-accent': onClick && !selected,
    })}
    onClick={onClick}
  >
    {children}
  </Card>
)

// Content component - can be used with or without Card wrapper
export const ClientInfoContent = ({ client, className, showMatchBadge = false }: ClientInfoContentProps) => {
  // Check if client has match information (SimpleClient with match data)
  const hasMatchInfo = 'matchType' in client && client.matchType
  const matchType = hasMatchInfo ? client.matchType : undefined
  const score = hasMatchInfo && 'score' in client ? client.score : undefined

  return (
    <div className={cn('flex items-start gap-4', className)}>
      <Avatar className="h-12 w-12 shrink-0">
        <AvatarImage src={client.headshot ?? undefined} />
        <AvatarFallback>
          {client.firstName?.[0]}
          {client.lastName?.[0]}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('truncate font-semibold')}>
            {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
            {client.lastName}
          </p>
          {showMatchBadge && hasMatchInfo && (
            <Badge
              variant={matchType === 'exact' ? 'default' : 'secondary'}
              className={cn('shrink-0', {
                'bg-green-500 hover:bg-green-600': matchType === 'exact',
              })}
            >
              {matchType === 'exact' ? 'Exact Match' : `${Math.round((score ?? 0) * 100)}% Match`}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
          <Mail className="h-3.5 w-3.5" />
          <span className="truncate">{client.email}</span>
        </div>
      </div>
    </div>
  )
}

// Wrapped version with CardContent padding
export const ClientInfo = ({ client }: { client: FormClient }) => {
  return (
    <CardContent className="pt-6">
      <ClientInfoContent client={client} />
    </CardContent>
  )
}

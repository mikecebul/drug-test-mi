import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/utilities/cn'
import { Mail } from 'lucide-react'
import { FormValues } from '../validators'

interface ClientCardProps {
  client: FormValues['client']
  selected?: boolean
}

export const ClientDisplayCard = ({ client, selected }: ClientCardProps) => (
  <Card
    className={cn('', {
      'border-info bg-info-muted shadow-sm': selected,
    })}
  >
    <CardContent className="pt-6">
      <div className="flex items-start gap-4">
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
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{client.email}</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
)

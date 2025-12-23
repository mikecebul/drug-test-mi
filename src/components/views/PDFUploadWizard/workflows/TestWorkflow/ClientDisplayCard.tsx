import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/utilities/cn'
import { CheckCircle2, Mail } from 'lucide-react'
import { FormValues } from '../../workflows/TestWorkflow/validators'

interface ClientCardProps {
  client: FormValues['clientData']
  onClick?: () => void
  selected?: boolean
}

export const ClientDisplayCard = ({ client, onClick, selected }: ClientCardProps) => (
  <Card
    className={cn('hover:border-primary cursor-pointer transition-all', {
      'border-success bg-success-muted shadow-sm': selected,
    })}
    onClick={onClick}
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
            <p
              className={cn(
                'truncate font-semibold',
                selected ? 'text-success-foreground' : 'text-foreground',
              )}
            >
              {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
              {client.lastName}
            </p>
            {/* {client.matchType === 'exact' && <Badge className="bg-green-600">Exact</Badge>}
            {client.score > 0 && client.matchType !== 'exact' && (
              <Badge variant="secondary">{Math.round(client.score * 100)}% Match</Badge>
            )} */}
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

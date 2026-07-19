'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Check, UserPlus, Loader2 } from 'lucide-react'
import { SimpleClient } from './getClients'
import { FieldGroupHeader } from '../FieldGroupHeader'
import { ClientDisplayCard, ClientInfoContent } from './ClientDisplayCard'
import { ClientSearchDialog } from './ClientSearchDialog'
import { cn } from '@/utilities/cn'
import Link from 'next/link'
import { useDismissModal } from '@/components/ui/dialog'
import { FormClient } from '../../shared-validators'

interface ClientStepUIProps {
  selectedClient: FormClient
  onSelectClient: (client: SimpleClient) => void
  errors: string[]
  returnToWorkflow: 'collect-lab' | 'instant-test' | '17-panel-instant'
  onRegisterNewClient?: () => void
  suggestedMatches?: SimpleClient[]
  donorName?: string | null
  isLoading?: boolean
}

export const ClientStepUI = ({
  selectedClient,
  onSelectClient,
  errors,
  returnToWorkflow,
  onRegisterNewClient,
  suggestedMatches = [],
  donorName,
  isLoading = false,
}: ClientStepUIProps) => {
  const { dismiss } = useDismissModal()

  const exactMatches = suggestedMatches.filter((match) => match.matchType === 'exact')
  const possibleMatches = suggestedMatches.filter((match) => match.matchType !== 'exact')

  const handleSelectClient = (client: SimpleClient) => {
    onSelectClient(client)
    try {
      dismiss()
    } catch (_e) {
      console.log('No active modal to dismiss')
    }
  }

  // Show loading state while searching for matches
  if (isLoading) {
    return (
      <div>
        <FieldGroupHeader
          title="Searching for Client..."
          description={donorName ? `Looking for: ${donorName}` : 'Searching client database'}
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="space-y-4 text-center">
                <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                <p className="text-muted-foreground text-lg">Please wait while we search for matches</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <FieldGroupHeader
        title="Choose a Client"
        description={
          donorName ? `Select the correct client for: ${donorName}` : 'Select an existing client or register a new one.'
        }
      />
      <div className="space-y-6">
        {/* STATE 1: Confirming Selection */}
        {selectedClient.id ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3">
            <h4 className="text-muted-foreground px-1 text-sm font-medium">Selected Client</h4>

            <ClientDisplayCard selected={true}>
              <ClientInfoContent client={selectedClient} />
            </ClientDisplayCard>
          </div>
        ) : (
          /* STATE 2: Suggested Matches */
          suggestedMatches.length > 0 && (
            <div className="space-y-3">
              {exactMatches.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-muted-foreground px-1 text-sm font-medium">Exact Matches</h4>
                  {exactMatches.map((match) => (
                    <ClientDisplayCard key={match.id} onClick={() => handleSelectClient(match)}>
                      <ClientInfoContent client={match} showMatchBadge={true} />
                    </ClientDisplayCard>
                  ))}
                </div>
              )}
              {possibleMatches.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-muted-foreground px-1 text-sm font-medium">Possible Matches</h4>
                  {possibleMatches.map((match) => (
                    <ClientDisplayCard key={match.id} onClick={() => handleSelectClient(match)}>
                      <ClientInfoContent client={match} showMatchBadge={true} />
                    </ClientDisplayCard>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* Actions: Always available */}
        <div className="flex flex-col justify-start gap-6 pt-4 sm:flex-row">
          <ClientSearchDialog selectedClientId={selectedClient.id} onSelect={handleSelectClient}>
            <Button type="button" size="xl" variant="default">
              <Check className="size-5" />
              {selectedClient.id ? 'Change Client' : 'Search All Clients'}
            </Button>
          </ClientSearchDialog>
          <Link
            className={cn(buttonVariants({ size: 'xl', variant: 'secondary' }))}
            href={`/admin/drug-test-upload?workflow=register-client&step=personalInfo&returnTo=${returnToWorkflow}`}
            onClick={onRegisterNewClient}
          >
            <UserPlus className="size-5" />
            Register New Client
          </Link>
        </div>
        {/* Error Message */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>{errors[0]}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

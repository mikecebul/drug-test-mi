'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ClientDetailsCard, type ClientDetailsValue } from '../workflows/components/client/ClientDetailsCard'
import { CollectionProgress } from './CollectionProgress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'

export const TestCompleted = ({
  testId,
  onBack,
  backLabel = 'Choose Another Workflow',
  client,
  awaitingLab = false,
  deliveryError,
  progress,
  title = 'Collection saved',
}: {
  testId: string
  onBack: () => void
  backLabel?: string
  client?: ClientDetailsValue
  awaitingLab?: boolean
  deliveryError?: string | null
  progress?: React.ReactNode
  title?: string
}) => {
  const router = useRouter()
  return (
    <>
      {progress ?? <CollectionProgress phase="Review" completed />}
      <div className="flex flex-col gap-6">
        {client && <ClientDetailsCard compact client={client} />}
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <Alert variant="success">
              <Check />
              <AlertTitle>
                <h1 className="text-xl font-semibold">{title}</h1>
              </AlertTitle>
            </Alert>
            {awaitingLab && <p className="text-muted-foreground">Awaiting lab results</p>}
            {deliveryError && (
              <Alert variant="warning">
                <AlertTitle>Notification needs attention</AlertTitle>
                <AlertDescription>
                  {deliveryError} Open the saved test to check delivery. The collection is already saved.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-between gap-3">
          <Button onClick={onBack} size="lg">
            {backLabel}
          </Button>
          <Button
            data-testid="wizard-view-drug-test-button"
            data-drug-test-id={testId}
            onClick={() => router.push(`/admin/collections/drug-tests/${testId}`)}
            variant="outline"
            size="lg"
          >
            View Drug Test
          </Button>
        </div>
      </div>
    </>
  )
}

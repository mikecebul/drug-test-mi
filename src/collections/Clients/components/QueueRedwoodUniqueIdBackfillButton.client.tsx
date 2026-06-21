'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { queueRedwoodUniqueIdBackfillAction } from './queueRedwoodUniqueIdBackfill'

interface QueueRedwoodUniqueIdBackfillButtonClientProps {
  clientId: string
}

export function QueueRedwoodUniqueIdBackfillButtonClient({
  clientId,
}: QueueRedwoodUniqueIdBackfillButtonClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleQueue = () => {
    startTransition(async () => {
      const result = await queueRedwoodUniqueIdBackfillAction(clientId)

      if (!result.success) {
        toast.error(result.error || 'Failed to queue Redwood unique ID backfill')
        return
      }

      toast.success(
        result.jobId ? `Redwood unique ID backfill queued (job ${result.jobId})` : 'Redwood unique ID backfill queued',
      )
      router.refresh()
    })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Button type="button" variant="outline" onClick={handleQueue} disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
        Backfill Redwood ID
      </Button>
    </ShadcnWrapper>
  )
}

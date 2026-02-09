'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { syncRedwoodHeadshot } from './syncRedwoodHeadshot'

interface SyncRedwoodHeadshotButtonClientProps {
  clientId: string
}

export function SyncRedwoodHeadshotButtonClient({ clientId }: SyncRedwoodHeadshotButtonClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncRedwoodHeadshot(clientId)

      if (!result.success) {
        toast.error(result.error || 'Failed to sync Redwood headshot')
        return
      }

      toast.success(
        result.matchedDonor
          ? `Headshot synced from Redwood (${result.matchedDonor})`
          : 'Headshot synced from Redwood',
      )

      router.refresh()
    })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Button type="button" variant="outline" onClick={handleSync} disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        Sync Redwood Headshot
      </Button>
    </ShadcnWrapper>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FlaskConical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { guidedWorkflowApi } from '@/views/DrugTestWizard/workflows/complete-workflow/guided-workflow-api'

export function CollectClientTestButton({ clientId }: { clientId: string }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  return (
    <Button
      disabled={pending}
      onClick={async () => {
        setPending(true)
        try {
          const result = await guidedWorkflowApi.createWalkIn({ clientId })
          if (!result.success || !result.bookingId) throw new Error(result.error || 'Unable to start collection.')
          router.push(`/admin/drug-test-upload?workflow=guided&step=review&bookingId=${result.bookingId}`)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Unable to start collection.')
          setPending(false)
        }
      }}
    >
      {pending ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <FlaskConical data-icon="inline-start" />
      )}
      Collect Test
    </Button>
  )
}

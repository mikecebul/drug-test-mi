'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import test from 'node:test'

export const TestCompleted = ({ testId, onBack }: { testId: string; onBack: () => void }) => {
  const router = useRouter()
  return (
    <>
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Drug Test Created Successfully!</h1>
        <p className="text-muted-foreground">
          The drug test has been created and notification emails have been sent.
        </p>
      </div>

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={onBack} size="lg" className="text-lg">
          Start New Test
        </Button>
        <Button
          onClick={() => router.push(`/admin/collections/drug-tests/${testId}`)}
          variant="outline"
          size="lg"
          className="text-lg"
        >
          View Drug Test
        </Button>
      </div>
    </>
  )
}

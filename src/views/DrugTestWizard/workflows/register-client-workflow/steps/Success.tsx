'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { HeadshotCaptureCard } from '../../components'

interface SuccessStepProps {
  clientId: string
  firstName: string
  lastName: string
  email: string
  middleInitial?: string | null
  dob?: string | null
  phone?: string | null
  onContinue: () => void
  returnTo?: string | null
}

export function SuccessStep({
  clientId,
  firstName,
  lastName,
  email,
  middleInitial,
  dob,
  phone,
  onContinue,
  returnTo,
}: SuccessStepProps) {
  // Determine button text based on where user came from
  const getButtonText = () => {
    if (returnTo === 'instant-test') {
      return 'Continue with 15 Panel Test'
    }
    if (returnTo === 'collect-lab') {
      return 'Continue with Lab Collection'
    }
    return 'Back to Workflow Selector'
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 pt-2 pb-10 text-center">
        <div className="bg-success/15 rounded-full p-3">
          <div className="bg-success flex h-16 w-16 items-center justify-center rounded-full">
            <Check className="text-success-foreground h-8 w-8" />
          </div>
        </div>
        <h1 className="text-success text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Registration Complete
        </h1>
      </div>

      {/* Headshot Upload Section */}
      <div className="mx-auto w-full max-w-xl space-y-3">
        <div>
          <h3 className="text-lg font-medium">Add Headshot Photo</h3>
          <p className="text-muted-foreground text-sm">Add a headshot to ensure ID in referall emails.</p>
        </div>
        <HeadshotCaptureCard
          client={{
            id: clientId,
            firstName,
            lastName,
            middleInitial,
            email,
            dob,
            phone,
            headshot: null,
            headshotId: null,
          }}
        />
      </div>

      {/* Action Button */}
      <div className="mx-auto w-full max-w-xl">
        <Button className="w-full cursor-pointer" size="lg" onClick={onContinue}>
          {getButtonText()}
        </Button>
      </div>
    </div>
  )
}

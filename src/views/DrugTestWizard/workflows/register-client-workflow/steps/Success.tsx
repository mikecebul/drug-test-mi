'use client'

import { useMemo } from 'react'
import { CalPopupButton } from '@/components/cal-popup-button'
import { Button } from '@/components/ui/button'
import { formatPhoneForCal } from '@/lib/quick-book'
import { Calendar, Check } from 'lucide-react'
import { HeadshotCaptureCard } from '../../components'

interface SuccessStepProps {
  clientId: string
  firstName: string
  lastName: string
  email: string
  middleInitial?: string | null
  dob?: string | null
  phone?: string | null
  onContinue: () => void | Promise<void>
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
  const isDashboardReturn = returnTo === 'dashboard'

  const scheduleConfig = useMemo(() => {
    const nameParts = [firstName, middleInitial?.trim(), lastName].filter(Boolean)
    const config: Record<string, unknown> = {
      name: nameParts.join(' '),
      email,
      overlayCalendar: true,
    }

    const formattedPhone = formatPhoneForCal(phone)
    if (formattedPhone) {
      config.attendeePhoneNumber = formattedPhone
      config.smsReminderNumber = formattedPhone
    }

    return config
  }, [email, firstName, lastName, middleInitial, phone])

  // Determine button text based on where user came from
  const getButtonText = () => {
    if (returnTo === 'instant-test') {
      return 'Continue with 15 Panel Test'
    }
    if (returnTo === 'collect-lab') {
      return 'Continue with Lab Collection'
    }
    if (isDashboardReturn) {
      return 'Back to Dashboard'
    }
    return 'Back to Workflow Selector'
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 pt-2 pb-10 text-center">
        <div className="bg-success-muted rounded-full p-3">
          <div className="bg-success flex h-16 w-16 items-center justify-center rounded-full">
            <Check className="text-success-foreground h-8 w-8" strokeWidth={3} />
          </div>
        </div>
        <h1 className="text-primary text-4xl font-semibold tracking-tight text-balance md:text-5xl">
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

      {/* Action Buttons */}
      <div className="mx-auto w-full max-w-xl space-y-3">
        {isDashboardReturn ? (
          <>
            <CalPopupButton calUsername="midrugtest/drug-test" config={scheduleConfig} className="w-full" variant="default">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule First Appointment
            </CalPopupButton>
            <Button className="w-full cursor-pointer" size="lg" variant="outline" onClick={() => void onContinue()}>
              Back to Dashboard
            </Button>
          </>
        ) : (
          <Button className="w-full cursor-pointer" size="lg" onClick={() => void onContinue()}>
            {getButtonText()}
          </Button>
        )}
      </div>
    </div>
  )
}

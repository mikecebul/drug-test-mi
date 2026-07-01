'use client'

import { useEffect, useMemo } from 'react'
import { getCalApi } from '@calcom/embed-react'
import { Calendar } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { FALLBACK_BOOKING_TEST_TYPES, formatPhoneForCal, type TestTypeBookingOption } from '@/lib/quick-book'
import { DRUG_TEST_CAL_LINK } from '@/utilities/calcom-config'

type TestTypeOption = TestTypeBookingOption

type CalModalConfig = Record<string, string | string[] | Record<string, string>>

interface QuickBookControlProps {
  clientName: string
  clientEmail: string
  clientPhone?: string
  recommendedTestTypeId?: string
  recommendedTestTypeValue?: string
  calLink?: string
  className?: string
}

function findRecommendedType(options: TestTypeOption[], id?: string, value?: string): TestTypeOption | undefined {
  if (id) {
    const byId = options.find((option) => option.id === id)
    if (byId) return byId
  }

  if (value) {
    return options.find((option) => option.value === value)
  }

  return undefined
}

export function QuickBookControl({
  clientName,
  clientEmail,
  clientPhone,
  recommendedTestTypeId,
  recommendedTestTypeValue,
  calLink = DRUG_TEST_CAL_LINK,
  className,
}: QuickBookControlProps) {
  useEffect(() => {
    getCalApi().then((cal) => {
      cal('ui', { theme: 'light' })
    })
  }, [])

  const availableTestTypes = useMemo(() => {
    return FALLBACK_BOOKING_TEST_TYPES
  }, [])

  const recommendedType = useMemo(() => {
    return findRecommendedType(availableTestTypes, recommendedTestTypeId, recommendedTestTypeValue)
  }, [availableTestTypes, recommendedTestTypeId, recommendedTestTypeValue])

  const selectedTestType = useMemo(() => {
    if (recommendedType) return recommendedType
    return availableTestTypes[0]
  }, [availableTestTypes, recommendedType])

  const handleBooking = async () => {
    if (!selectedTestType) return

    const cal = await getCalApi()
    const formattedPhone = formatPhoneForCal(clientPhone)

    const config: CalModalConfig = {
      name: clientName,
      email: clientEmail,
      test: selectedTestType.label,
      overlayCalendar: 'true',
    }

    if (formattedPhone) {
      config.attendeePhoneNumber = formattedPhone
      config.smsReminderNumber = formattedPhone
    }

    cal('modal', {
      calLink,
      config,
    })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button onClick={() => void handleBooking()} disabled={!selectedTestType}>
        <Calendar className="mr-2 h-4 w-4" />
        Quick Book
      </Button>
    </div>
  )
}

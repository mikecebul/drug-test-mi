'use client'

import { useEffect, useMemo, useState } from 'react'
import { getCalApi } from '@calcom/embed-react'
import { Calendar } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { formatPhoneForCal } from '@/lib/quick-book'

type TestTypeOption = {
  id: string
  value: string
  label: string
}

interface QuickBookControlProps {
  clientName: string
  clientEmail: string
  clientPhone?: string
  recommendedTestTypeId?: string
  recommendedTestTypeValue?: string
  className?: string
}

const FALLBACK_TEST_TYPES: TestTypeOption[] = [
  { id: '15-panel-instant', value: '15-panel-instant', label: '15 Panel Instant' },
  { id: '11-panel-lab', value: '11-panel-lab', label: '11 Panel Lab' },
  { id: '17-panel-sos-lab', value: '17-panel-sos-lab', label: '17 SOS Lab' },
  { id: 'etg-lab', value: 'etg-lab', label: 'EtG Lab' },
]

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
  className,
}: QuickBookControlProps) {
  const [testTypes, setTestTypes] = useState<TestTypeOption[]>([])

  useEffect(() => {
    getCalApi().then((cal) => {
      cal('ui', { theme: 'light' })
    })
  }, [])

  useEffect(() => {
    let mounted = true

    const fetchTestTypes = async () => {
      try {
        const response = await fetch('/api/test-types?limit=200&sort=label&where[isActive][equals]=true', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Failed to load test types: ${response.status}`)
        }

        const json = (await response.json()) as {
          docs?: Array<{ id?: string; value?: string; label?: string; bookingLabel?: string }>
        }

        const mapped = (json.docs || [])
          .map((doc) => {
            if (!doc.id || !doc.value) return null
            const label = doc.bookingLabel || doc.label || doc.value
            if (!label) return null
            return {
              id: doc.id,
              value: doc.value,
              label,
            }
          })
          .filter((item): item is TestTypeOption => item !== null)

        if (mounted) {
          setTestTypes(mapped)
        }
      } catch (error) {
        console.error('[QuickBookControl] Failed to fetch test types:', error)
        if (mounted) {
          setTestTypes([])
        }
      }
    }

    void fetchTestTypes()

    return () => {
      mounted = false
    }
  }, [])

  const availableTestTypes = useMemo(() => {
    return testTypes.length > 0 ? testTypes : FALLBACK_TEST_TYPES
  }, [testTypes])

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

    const config: Record<string, unknown> = {
      name: clientName,
      email: clientEmail,
      test: selectedTestType.label,
      overlayCalendar: true,
    }

    if (formattedPhone) {
      config.attendeePhoneNumber = formattedPhone
      config.smsReminderNumber = formattedPhone
    }

    cal('modal', {
      calLink: 'midrugtest/drug-test',
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

'use client'

import { useEffect, useMemo, useState } from 'react'
import { getCalApi } from '@calcom/embed-react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Calendar, ChevronDown } from 'lucide-react'

interface QuickBookButtonClientProps {
  clientName: string
  clientEmail: string
  clientPhone?: string
}

type TestTypeOption = {
  id: string
  label: string
}

const FALLBACK_TEST_TYPES: TestTypeOption[] = [
  { id: '15-panel-instant', label: '15 Panel Instant' },
  { id: '11-panel-lab', label: '11 Panel Lab' },
  { id: '17-panel-sos-lab', label: '17 SOS Lab' },
  { id: 'etg-lab', label: 'EtG Lab' },
]

/**
 * Client component that renders the Quick Book button with test type selection.
 * Opens Cal.com modal for the specific drug-test event with prefilled data.
 */
export function QuickBookButtonClient({ clientName, clientEmail, clientPhone }: QuickBookButtonClientProps) {
  const [testTypes, setTestTypes] = useState<TestTypeOption[]>([])

  // Initialize Cal.com embed on mount
  useEffect(() => {
    getCalApi().then((cal) => {
      cal('ui', {
        theme: 'light',
      })
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
          docs?: Array<{ id?: string; label?: string; bookingLabel?: string; value?: string }>
        }

        const mapped = (json.docs || [])
          .map((doc) => {
            if (!doc.id) return null
            const label = doc.bookingLabel || doc.label || doc.value
            if (!label) return null
            return {
              id: doc.id,
              label,
            }
          })
          .filter((item): item is TestTypeOption => item !== null)

        if (mounted) {
          setTestTypes(mapped)
        }
      } catch (error) {
        console.error('Failed to fetch test types for quick booking:', error)
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

  const handleBooking = async (testTypeLabel: string) => {
    const cal = await getCalApi()

    // Build config with all required fields
    const config: Record<string, any> = {
      name: clientName,
      email: clientEmail,
      test: testTypeLabel,
      overlayCalendar: true,
    }

    // Add phone numbers if available
    if (clientPhone) {
      config.attendeePhoneNumber = clientPhone
      config.smsReminderNumber = clientPhone
    }

    // Open modal with specific event type and config
    cal('modal', {
      calLink: 'midrugtest/drug-test',
      config,
    })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Quick Book
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableTestTypes.map((testType) => (
            <DropdownMenuItem key={testType.id} onClick={() => handleBooking(testType.label)}>
              {testType.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ShadcnWrapper>
  )
}

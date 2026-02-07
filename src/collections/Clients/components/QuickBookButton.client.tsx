'use client'

import { useEffect } from 'react'
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

const TEST_TYPES = ['15 Panel Instant', '11 Panel Lab', '17 SOS Lab', 'EtG Lab'] as const

type TestType = (typeof TEST_TYPES)[number]

/**
 * Client component that renders the Quick Book button with test type selection.
 * Opens Cal.com modal for the specific drug-test event with prefilled data.
 */
export function QuickBookButtonClient({ clientName, clientEmail, clientPhone }: QuickBookButtonClientProps) {
  // Initialize Cal.com embed on mount
  useEffect(() => {
    getCalApi().then((cal) => {
      cal('ui', {
        theme: 'light',
      })
    })
  }, [])

  const handleBooking = async (testType: TestType) => {
    const cal = await getCalApi()

    // Build config with all required fields
    const config: Record<string, any> = {
      name: clientName,
      email: clientEmail,
      test: testType,
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
          {TEST_TYPES.map((testType) => (
            <DropdownMenuItem key={testType} onClick={() => handleBooking(testType)}>
              {testType}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ShadcnWrapper>
  )
}

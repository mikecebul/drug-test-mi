'use client'

import { useEffect, useMemo, useState } from 'react'
import { getCalApi } from '@calcom/embed-react'
import { Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  extractPreferredTestType,
  extractReferralRelation,
  formatPhoneForCal,
  RecommendedTestType,
} from '@/lib/quick-book'
import { sdk } from '@/lib/payload-sdk'
import { searchClients } from '@/views/DrugTestWizard/workflows/components/client/clientSearch'
import { getClients, SimpleClient } from '@/views/DrugTestWizard/workflows/components/client/getClients'

type TestTypeOption = {
  id: string
  value: string
  label: string
}

const FALLBACK_TEST_TYPES: TestTypeOption[] = [
  { id: '15-panel-instant', value: '15-panel-instant', label: '15 Panel Instant' },
  { id: '11-panel-lab', value: '11-panel-lab', label: '11 Panel Lab' },
  { id: '17-panel-sos-lab', value: '17-panel-sos-lab', label: '17 SOS Lab' },
  { id: 'etg-lab', value: 'etg-lab', label: 'EtG Lab' },
]

async function resolveClientRecommendation(clientId: string): Promise<RecommendedTestType> {
  const client = await sdk.findByID({
    collection: 'clients',
    id: clientId,
    depth: 2,
    select: {
      referralType: true,
      referral: true,
    },
  })

  if (client.referralType !== 'court' && client.referralType !== 'employer') {
    return {}
  }

  const relationRef = extractReferralRelation(client.referral)
  if (!relationRef) {
    return {}
  }

  if (client.referral && typeof client.referral === 'object' && 'value' in client.referral) {
    const referralValue = client.referral.value
    if (typeof referralValue === 'object' && referralValue !== null) {
      const extracted = extractPreferredTestType(
        'preferredTestType' in referralValue ? referralValue.preferredTestType : undefined,
      )
      if (extracted.recommendedTestTypeId || extracted.recommendedTestTypeValue) {
        return extracted
      }
    }
  }

  const referralDoc = await sdk.findByID({
    collection: relationRef.relationTo,
    id: relationRef.referralId,
    depth: 1,
    select: {
      preferredTestType: true,
    },
  })

  const extractedFromReferral = extractPreferredTestType(referralDoc.preferredTestType)
  if (!extractedFromReferral.recommendedTestTypeId && !extractedFromReferral.recommendedTestTypeValue) {
    return {}
  }

  if (!extractedFromReferral.recommendedTestTypeValue && extractedFromReferral.recommendedTestTypeId) {
    try {
      const testTypeDoc = await sdk.findByID({
        collection: 'test-types',
        id: extractedFromReferral.recommendedTestTypeId,
        depth: 0,
        select: {
          value: true,
        },
      })

      return {
        ...extractedFromReferral,
        ...(testTypeDoc.value ? { recommendedTestTypeValue: testTypeDoc.value } : {}),
      }
    } catch (error) {
      console.warn('[AdminQuickBookWidget] Failed to fetch recommended test type value', error)
    }
  }

  return extractedFromReferral
}

async function fetchTestTypes(): Promise<TestTypeOption[]> {
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

    return (json.docs || [])
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
  } catch (error) {
    console.error('[AdminQuickBookWidget] Failed to fetch test types', error)
    return []
  }
}

function resolveTestLabel(options: TestTypeOption[], recommendation: RecommendedTestType): string {
  const byId = recommendation.recommendedTestTypeId
    ? options.find((option) => option.id === recommendation.recommendedTestTypeId)
    : undefined
  if (byId) return byId.label

  const byValue = recommendation.recommendedTestTypeValue
    ? options.find((option) => option.value === recommendation.recommendedTestTypeValue)
    : undefined
  if (byValue) return byValue.label

  return options[0]?.label ?? FALLBACK_TEST_TYPES[0].label
}

export function AdminQuickBookWidgetClient() {
  const [clients, setClients] = useState<SimpleClient[]>([])
  const [testTypes, setTestTypes] = useState<TestTypeOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [isOpeningBooking, setIsOpeningBooking] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)

  useEffect(() => {
    getCalApi().then((cal) => {
      cal('ui', { theme: 'light' })
    })
  }, [])

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [clientList, availableTestTypes] = await Promise.all([getClients(), fetchTestTypes()])
        if (!mounted) return
        setClients(clientList)
        setTestTypes(availableTestTypes)
      } catch (error) {
        console.error('[AdminQuickBookWidget] Failed to load clients', error)
        if (!mounted) return
        setLoadError('Unable to load clients right now.')
      } finally {
        if (mounted) {
          setIsLoadingClients(false)
        }
      }
    }

    void loadData()

    return () => {
      mounted = false
    }
  }, [])

  const results = useMemo(() => {
    return searchClients(clients, searchQuery.trim(), 8)
  }, [clients, searchQuery])

  const handleSelectClient = async (client: SimpleClient) => {
    setBookingError(null)
    setSearchQuery(client.fullName || `${client.firstName} ${client.lastName}`)
    setIsDropdownOpen(false)
    setIsOpeningBooking(true)

    try {
      const recommendation = await resolveClientRecommendation(client.id)
      const options = testTypes.length > 0 ? testTypes : FALLBACK_TEST_TYPES
      const selectedTestLabel = resolveTestLabel(options, recommendation)
      const cal = await getCalApi()

      const config: Record<string, unknown> = {
        name: client.fullName || `${client.firstName} ${client.lastName}`,
        email: client.email,
        test: selectedTestLabel,
        overlayCalendar: true,
      }

      const formattedPhone = formatPhoneForCal(client.phone)
      if (formattedPhone) {
        config.attendeePhoneNumber = formattedPhone
        config.smsReminderNumber = formattedPhone
      }

      cal('modal', {
        calLink: 'midrugtest/drug-test',
        config,
      })
    } catch (error) {
      console.error('[AdminQuickBookWidget] Failed to open booking', error)
      setBookingError('Could not open booking. Please try again.')
    } finally {
      setIsOpeningBooking(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value)
            setIsDropdownOpen(true)
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsDropdownOpen(false), 120)
          }}
          placeholder="Search client and book..."
          disabled={isLoadingClients || isOpeningBooking || !!loadError}
        />
        {(isLoadingClients || isOpeningBooking) && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
        {isDropdownOpen && !isLoadingClients && results.length > 0 && (
          <div className="bg-popover border-border absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-md">
            {results.map((client) => (
              <button
                key={client.id}
                type="button"
                className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
                onMouseDown={(event) => {
                  event.preventDefault()
                  void handleSelectClient(client)
                }}
              >
                <p className="text-sm font-medium">{client.fullName || `${client.firstName} ${client.lastName}`}</p>
                <p className="text-muted-foreground text-xs">{client.email}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadError && <p className="text-destructive text-xs">{loadError}</p>}
      {bookingError && <p className="text-destructive text-xs">{bookingError}</p>}
      {isDropdownOpen && !isLoadingClients && results.length === 0 && (
        <p className="text-muted-foreground text-xs">No matching clients.</p>
      )}
    </div>
  )
}

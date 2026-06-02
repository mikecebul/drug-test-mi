'use client'

import { useEffect, useMemo, useState } from 'react'
import { getCalApi } from '@calcom/embed-react'
import { Calendar, Loader2, Search } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  extractPreferredTestType,
  extractReferralRelation,
  FALLBACK_BOOKING_TEST_TYPES,
  formatPhoneForCal,
  resolveRecommendedTestLabel,
  type RecommendedTestType,
  type TestTypeBookingOption,
} from '@/lib/quick-book'
import { sdk } from '@/lib/payload-sdk'
import { INSTANT_17_PANEL_CAL_LINK } from '@/utilities/calcom-config'
import { searchClients } from '@/views/DrugTestWizard/workflows/components/client/clientSearch'
import { getClients, SimpleClient } from '@/views/DrugTestWizard/workflows/components/client/getClients'

type TestTypeOption = TestTypeBookingOption

type CalModalConfig = Record<string, string | string[] | Record<string, string>>

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
  return (
    resolveRecommendedTestLabel(options, recommendation) ?? options[0]?.label ?? FALLBACK_BOOKING_TEST_TYPES[0].label
  )
}

type AdminQuickBookWidgetClientProps = {
  resultsMode?: 'inline' | 'popover'
  searchInputId?: string
}

export function AdminQuickBookWidgetClient({
  resultsMode = 'popover',
  searchInputId = 'admin-quick-book-search',
}: AdminQuickBookWidgetClientProps = {}) {
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

  const openCalBookingModal = async (config: CalModalConfig) => {
    const cal = await getCalApi()

    cal('modal', {
      calLink: INSTANT_17_PANEL_CAL_LINK,
      config: {
        overlayCalendar: 'true',
        ...config,
      },
    })
  }

  const handleSelectClient = async (client: SimpleClient) => {
    setBookingError(null)
    setSearchQuery(client.fullName || `${client.firstName} ${client.lastName}`)
    setIsDropdownOpen(false)
    setIsOpeningBooking(true)

    try {
      const recommendation = await resolveClientRecommendation(client.id)
      const options = testTypes.length > 0 ? testTypes : FALLBACK_BOOKING_TEST_TYPES
      const selectedTestLabel = resolveTestLabel(options, recommendation)

      const config: CalModalConfig = {
        name: client.fullName || `${client.firstName} ${client.lastName}`,
        email: client.email,
        test: selectedTestLabel,
      }

      const formattedPhone = formatPhoneForCal(client.phone)
      if (formattedPhone) {
        config.attendeePhoneNumber = formattedPhone
        config.smsReminderNumber = formattedPhone
      }

      await openCalBookingModal(config)
    } catch (error) {
      console.error('[AdminQuickBookWidget] Failed to open booking', error)
      setBookingError('Could not open booking. Please try again.')
    } finally {
      setIsOpeningBooking(false)
    }
  }

  const handleBookUnregistered = async () => {
    setBookingError(null)
    setIsDropdownOpen(false)
    setSearchQuery('')
    setIsOpeningBooking(true)

    try {
      await openCalBookingModal({})
    } catch (error) {
      console.error('[AdminQuickBookWidget] Failed to open unregistered booking', error)
      setBookingError('Could not open booking. Please try again.')
    } finally {
      setIsOpeningBooking(false)
    }
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="existing">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing">Existing Client</TabsTrigger>
          <TabsTrigger value="new">New Client</TabsTrigger>
        </TabsList>

        <TabsContent value="existing" className="mt-2 space-y-2">
          <div className="relative">
            <label htmlFor={searchInputId} className="sr-only">
              Search Existing Client
            </label>
            <Search className="text-primary/70 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id={searchInputId}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setIsDropdownOpen(true)
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => setIsDropdownOpen(false), 120)
              }}
              placeholder="Search client name, email, phone, or DOB..."
              className="border-primary/35 bg-background focus-visible:border-primary focus-visible:ring-primary/20 h-11 rounded-md pr-10 pl-10 shadow-sm focus-visible:ring-4"
              disabled={isLoadingClients || isOpeningBooking || !!loadError}
            />
            {(isLoadingClients || isOpeningBooking) && (
              <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
            )}
            {isDropdownOpen && !isLoadingClients && results.length > 0 && (
              <div
                className={
                  resultsMode === 'inline'
                    ? 'bg-popover border-border relative mt-2 max-h-[min(18rem,36vh)] w-full overflow-y-auto rounded-md border shadow-sm'
                    : 'bg-popover border-border absolute z-[80] mt-1 max-h-80 w-full overflow-y-auto rounded-md border shadow-lg'
                }
              >
                {results.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 px-3 py-2 text-left"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      void handleSelectClient(client)
                    }}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage
                        src={client.headshot ?? undefined}
                        alt={client.fullName || `${client.firstName} ${client.lastName}`}
                      />
                      <AvatarFallback className="text-xs font-semibold">{client.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {client.fullName || `${client.firstName} ${client.lastName}`}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{client.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-xs">Selecting a client opens Cal.com with their details.</p>
        </TabsContent>

        <TabsContent value="new" className="mt-2 space-y-3">
          <div className="border-border/70 bg-muted/30 rounded-md border px-3 py-3">
            <p className="text-sm font-medium">Book an appointment before registration.</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Use this for walk-ins or clients who are not in Payload yet.
            </p>
          </div>
          <Button
            type="button"
            className="h-11 w-full justify-center px-4"
            onClick={() => void handleBookUnregistered()}
            disabled={isOpeningBooking}
          >
            <Calendar className="h-4 w-4" />
            Book Appointment
          </Button>
        </TabsContent>
      </Tabs>

      {loadError && <p className="text-destructive text-xs">{loadError}</p>}
      {bookingError && <p className="text-destructive text-xs">{bookingError}</p>}
      {isDropdownOpen && !isLoadingClients && results.length === 0 && searchQuery.trim().length > 0 && (
        <p className="text-muted-foreground text-xs">No matching clients.</p>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
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
import { DRUG_TEST_CAL_LINK, getAdminQuickBookCalLink } from '@/utilities/calcom-config'
import { installCalModalStabilityPatch } from '@/utilities/calcom-modal-stability'
import { CLIENT_SEARCH_MIN_CHARS } from '@/views/DrugTestWizard/workflows/components/client/clientSearch'
import type { SimpleClient } from '@/views/DrugTestWizard/workflows/components/client/getClients'
import { useClientSearch } from '@/views/DrugTestWizard/workflows/components/client/useClientSearch'

type TestTypeOption = TestTypeBookingOption

type CalModalConfig = Record<string, string | string[] | Record<string, string>>
type AdminQuickBookClientContext = {
  calLink: string
  recommendation: RecommendedTestType
}

const ADMIN_QUICK_BOOK_CAL_NAMESPACE = 'admin-quick-book'

function getReferralNameFromValue(referralValue: unknown): string | undefined {
  if (referralValue && typeof referralValue === 'object' && 'name' in referralValue) {
    return typeof referralValue.name === 'string' ? referralValue.name : undefined
  }

  return undefined
}

async function resolveClientQuickBookContext(clientId: string): Promise<AdminQuickBookClientContext> {
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
    return {
      calLink: DRUG_TEST_CAL_LINK,
      recommendation: {},
    }
  }

  const relationRef = extractReferralRelation(client.referral)
  if (!relationRef) {
    return {
      calLink: DRUG_TEST_CAL_LINK,
      recommendation: {},
    }
  }

  let referralName: string | undefined
  let recommendation: RecommendedTestType = {}

  if (client.referral && typeof client.referral === 'object' && 'value' in client.referral) {
    const referralValue = client.referral.value
    referralName = getReferralNameFromValue(referralValue)

    if (typeof referralValue === 'object' && referralValue !== null) {
      const extracted = extractPreferredTestType(
        'preferredTestType' in referralValue ? referralValue.preferredTestType : undefined,
      )
      if (extracted.recommendedTestTypeId || extracted.recommendedTestTypeValue) {
        recommendation = extracted
      }
    }
  }

  if (!referralName || (!recommendation.recommendedTestTypeId && !recommendation.recommendedTestTypeValue)) {
    const referralDoc = await sdk.findByID({
      collection: relationRef.relationTo,
      id: relationRef.referralId,
      depth: 1,
      select: {
        name: true,
        preferredTestType: true,
      },
    })

    referralName = referralName || getReferralNameFromValue(referralDoc)
    recommendation = extractPreferredTestType(referralDoc.preferredTestType)
  }

  const calLink = getAdminQuickBookCalLink({
    referralType: client.referralType,
    referralName,
  })
  if (!recommendation.recommendedTestTypeId && !recommendation.recommendedTestTypeValue) {
    return {
      calLink,
      recommendation: {},
    }
  }

  return {
    calLink,
    recommendation,
  }
}

function resolveTestLabel(options: TestTypeOption[], recommendation: RecommendedTestType): string {
  return (
    resolveRecommendedTestLabel(options, recommendation) ?? options[0]?.label ?? FALLBACK_BOOKING_TEST_TYPES[0].label
  )
}

function QuickBookClientResult({
  client,
  onSelect,
}: {
  client: SimpleClient
  onSelect: (client: SimpleClient) => Promise<void>
}) {
  const reason = client.matchReason === 'date-of-birth' ? 'DOB' : client.matchReason || 'identity'
  const matchLabel =
    client.matchType === 'exact'
      ? `Exact ${reason}`
      : client.matchType === 'partial'
        ? `Partial ${reason}`
        : `Possible ${reason} match`

  return (
    <button
      type="button"
      className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 px-3 py-2 text-left"
      onMouseDown={(event) => {
        event.preventDefault()
        void onSelect(client)
      }}
    >
      <Avatar className="size-8 shrink-0">
        <AvatarImage
          src={client.headshot ?? undefined}
          alt={client.fullName || `${client.firstName} ${client.lastName}`}
        />
        <AvatarFallback className="text-xs font-semibold">{client.initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{client.fullName || `${client.firstName} ${client.lastName}`}</p>
          <span className="text-muted-foreground shrink-0 text-[10.4px] font-semibold tracking-wide uppercase">
            {matchLabel}
          </span>
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {client.email}
          {client.phone ? ` · ${client.phone}` : ''}
        </p>
      </div>
    </button>
  )
}

type AdminQuickBookWidgetClientProps = {
  onBeforeOpenBooking?: () => void | Promise<void>
  resultsMode?: 'inline' | 'popover'
  searchInputId?: string
}

export function AdminQuickBookWidgetClient({
  onBeforeOpenBooking,
  resultsMode = 'popover',
  searchInputId = 'admin-quick-book-search',
}: AdminQuickBookWidgetClientProps = {}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isOpeningBooking, setIsOpeningBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  useEffect(() => {
    getCalApi({ namespace: ADMIN_QUICK_BOOK_CAL_NAMESPACE }).then((cal) => {
      cal('ui', { theme: 'light' })
    })
  }, [])

  const clientSearch = useClientSearch(
    { query: searchQuery.trim(), limit: 8 },
    { enabled: isDropdownOpen && searchQuery.trim().length > 0 },
  )
  const exactMatches = clientSearch.isDebouncing ? [] : (clientSearch.data?.exactMatches ?? [])
  const possibleMatches = clientSearch.isDebouncing ? [] : (clientSearch.data?.possibleMatches ?? [])
  const results = [...exactMatches, ...possibleMatches]
  const isLoadingClients = clientSearch.isFetching || clientSearch.isDebouncing

  const openCalBookingModal = async (config: CalModalConfig, calLink = DRUG_TEST_CAL_LINK) => {
    const cal = await getCalApi({ namespace: ADMIN_QUICK_BOOK_CAL_NAMESPACE })

    if (onBeforeOpenBooking) {
      try {
        await onBeforeOpenBooking()
      } catch (error) {
        console.error('[AdminQuickBookWidget] Failed to run booking pre-open callback', error)
      }
    }

    installCalModalStabilityPatch()

    cal('modal', {
      calLink,
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
      const quickBookContext = await resolveClientQuickBookContext(client.id)
      const selectedTestLabel = resolveTestLabel(FALLBACK_BOOKING_TEST_TYPES, quickBookContext.recommendation)

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

      await openCalBookingModal(config, quickBookContext.calLink)
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
            <Search className="text-primary/70 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
              className="border-primary/35 bg-background focus-visible:border-primary focus-visible:ring-primary/20 rounded-md pr-10 pl-10 shadow-sm focus-visible:ring-4"
              disabled={isOpeningBooking}
            />
            {(isLoadingClients || isOpeningBooking) && (
              <Loader2 className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
            )}
            {isDropdownOpen && !isLoadingClients && results.length > 0 && (
              <div
                className={
                  resultsMode === 'inline'
                    ? 'bg-popover border-border relative mt-2 max-h-[min(288px,36vh)] w-full overflow-y-auto rounded-md border shadow-sm'
                    : 'bg-popover border-border absolute z-[80] mt-1 max-h-80 w-full overflow-y-auto rounded-md border shadow-lg'
                }
              >
                {exactMatches.length > 0 && (
                  <p className="text-muted-foreground border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase">
                    Exact Matches
                  </p>
                )}
                {exactMatches.map((client) => (
                  <QuickBookClientResult key={client.id} client={client} onSelect={handleSelectClient} />
                ))}
                {possibleMatches.length > 0 && (
                  <p className="text-muted-foreground border-y px-3 py-2 text-xs font-semibold tracking-wide uppercase">
                    Possible Matches
                  </p>
                )}
                {possibleMatches.map((client) => (
                  <QuickBookClientResult key={client.id} client={client} onSelect={handleSelectClient} />
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
            className="w-full justify-center"
            onClick={() => void handleBookUnregistered()}
            disabled={isOpeningBooking}
          >
            <Calendar className="h-4 w-4" />
            Book Appointment
          </Button>
        </TabsContent>
      </Tabs>

      {clientSearch.isError && <p className="text-destructive text-xs">Unable to search clients right now.</p>}
      {bookingError && <p className="text-destructive text-xs">{bookingError}</p>}
      {isDropdownOpen && clientSearch.isTooShort && (
        <p className="text-muted-foreground text-xs">Enter at least {CLIENT_SEARCH_MIN_CHARS} characters to search.</p>
      )}
      {isDropdownOpen &&
        !clientSearch.isTooShort &&
        !isLoadingClients &&
        results.length === 0 &&
        searchQuery.trim().length > 0 && <p className="text-muted-foreground text-xs">No matching clients.</p>}
    </div>
  )
}

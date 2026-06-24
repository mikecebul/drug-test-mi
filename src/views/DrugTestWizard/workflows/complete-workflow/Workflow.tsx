'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FilePenLine,
  FlaskConical,
  Loader2,
  ClipboardList,
  Search,
  TriangleAlert,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { cn } from '@/utilities/cn'
import { ClientSearchDialog } from '../components/client/ClientSearchDialog'
import { getClients, type SimpleClient } from '../components/client/getClients'
import { searchClients } from '../components/client/clientSearch'
import {
  getActiveCollectionTestTypes,
  getClientReferralProfile,
  getTodaysCollectionBookings,
  linkBookingToClient,
  recordBookingPayment,
  refreshBookingClientContext,
  setBookingScheduledTestType,
} from './actions'
import { getGuidedBookingNextStep, getGuidedPaymentChoice, getGuidedPaymentLabel } from './schedule-utils'
import { ReferralProfileDrawer } from '../components/emails/referrals/ReferralProfileDrawer'

type Booking = Awaited<ReturnType<typeof getTodaysCollectionBookings>>[number]
type TestType = NonNullable<Booking['testType']>
type PaymentMethod = 'cash' | 'card' | 'not-paid' | 'pre-paid'
type PaymentStatus = 'paid' | 'partial' | 'unpaid'
type WorkflowStep = 'schedule' | 'registration' | 'payment' | 'toxaccess'
type PaymentChoice = 'paid' | 'still-owes'

const workflowSteps = ['schedule', 'registration', 'payment', 'toxaccess'] as const

interface GuidedWorkflowProps {
  onBack: () => void
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(new Date(value))
}

function formatGender(value?: string | null) {
  if (value === 'male') return 'Male'
  if (value === 'female') return 'Female'
  if (value === 'other') return 'Other'
  if (value === 'prefer-not-to-say') return 'Prefer not to say'
  return 'Unknown'
}

function formatDateOnly(value?: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getPaymentChoice(payment: Booking['payment'] | undefined): PaymentChoice | null {
  const choice = getGuidedPaymentChoice(payment)
  if (choice === 'still-owes') return 'still-owes'
  if (choice === 'paid' || choice === 'pre-paid') return 'paid'
  return null
}

function getPaymentDefaults(booking: Booking | null) {
  const amountDue = booking?.testType?.price ?? 0
  const existing = booking?.payment
  const existingAmountPaid = typeof existing?.amountPaid === 'number' ? existing.amountPaid : 0
  const choice =
    existing?.status && amountDue > 0 && existingAmountPaid < amountDue ? 'still-owes' : getPaymentChoice(existing)
  const defaultAmountPaid = choice === 'paid' ? amountDue : 0

  return {
    amountDue,
    amountPaid: typeof existing?.amountPaid === 'number' ? existing.amountPaid : defaultAmountPaid,
    choice,
    method: existing?.method ?? null,
  }
}

function getPersistedPayment(input: ReturnType<typeof getPaymentDefaults>): {
  status: PaymentStatus
  method: PaymentMethod
  amountPaid: number
} {
  if (input.choice === 'still-owes') {
    return {
      status: 'partial',
      method: 'not-paid',
      amountPaid: Math.max(0, Math.min(input.amountPaid, input.amountDue)),
    }
  }

  return {
    status: 'paid',
    method: input.method === 'pre-paid' ? 'pre-paid' : input.method === 'card' ? 'card' : 'cash',
    amountPaid: input.amountDue,
  }
}

function getPaymentLabel(booking: Booking) {
  return getGuidedPaymentLabel(booking)
}

function getBookingContactEmail(booking: Booking) {
  return booking.client?.email || booking.attendeeEmail
}

function getAmountDisplay(booking: Booking) {
  if (!booking.testType) {
    return {
      amount: 'Pending',
      badge: null,
      badgeVariant: 'secondary' as const,
    }
  }

  const amountDue = booking.testType.price
  const amountPaid = booking.payment?.amountPaid ?? 0
  const balance = Math.max(0, amountDue - amountPaid)

  if (booking.payment?.status === 'paid') {
    return {
      amount: currency.format(amountDue),
      badge: booking.payment.method === 'pre-paid' ? 'Pre-paid' : 'Paid',
      badgeVariant: 'success' as const,
    }
  }

  if (booking.payment?.status === 'partial') {
    return {
      amount: currency.format(amountDue),
      badge: `${currency.format(balance)} owed`,
      badgeVariant: 'warning' as const,
    }
  }

  return {
    amount: currency.format(amountDue),
    badge: booking.payment?.status === 'unpaid' ? 'Unpaid' : 'Due',
    badgeVariant: 'outline' as const,
  }
}

function getToxAccessName(booking: Booking, includeMiddlePlaceholder = false) {
  const client = booking.client
  if (!client) return booking.attendeeName

  const firstName = client.firstName || booking.attendeeName.split(/\s+/)[0] || 'Unknown'
  const lastName = client.lastName || booking.attendeeName.split(/\s+/).slice(1).join(' ') || 'Unknown'

  if (!includeMiddlePlaceholder) return [firstName, client.middleInitial, lastName].filter(Boolean).join(' ')

  return [firstName, client.middleInitial || '?', lastName].join(' ')
}

function getToxAccessTestValue(testType: Booking['testType']) {
  if (!testType) return 'Not set'
  if (testType.category === 'lab') return `${testType.toxAccessCode || 'Not set'} · ${testType.label}`
  return testType.label
}

function getCollectionRoute(testType: TestType, clientId: string, bookingId: string) {
  const params = new URLSearchParams({
    clientId,
    bookingId,
    returnTo: 'guided',
    testType: testType.value,
  })

  if (testType.category === 'instant') {
    params.set('workflow', 'instant-test')
    params.set('step', 'upload')
    return `/admin/drug-test-upload?${params.toString()}`
  }

  params.set('workflow', 'collect-lab')
  params.set('step', 'medications')
  return `/admin/drug-test-upload?${params.toString()}`
}

function getNextStep(booking: Booking): WorkflowStep {
  return getGuidedBookingNextStep(booking)
}

export function GuidedWorkflow({ onBack }: GuidedWorkflowProps) {
  const router = useRouter()
  const [query, setQuery] = useQueryStates({
    step: parseAsStringLiteral(workflowSteps).withDefault('schedule'),
    bookingId: parseAsString,
  })
  const {
    data: bookings = [],
    isLoading,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['guided', 'today-bookings'],
    queryFn: getTodaysCollectionBookings,
    refetchOnMount: 'always',
  })
  const { data: allClients } = useQuery({
    queryKey: ['guided', 'clients'],
    queryFn: getClients,
  })
  const { data: testTypes = [] } = useQuery({
    queryKey: ['guided', 'test-types'],
    queryFn: getActiveCollectionTestTypes,
  })
  const [isPending, startTransition] = useTransition()
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === query.bookingId) ?? null,
    [bookings, query.bookingId],
  )
  const selectedClientId = selectedBooking?.client?.id ?? null
  const { data: referralProfile = null, refetch: refetchReferralProfile } = useQuery({
    queryKey: ['guided', 'referral-profile', selectedClientId],
    queryFn: () => getClientReferralProfile(selectedClientId || ''),
    enabled: Boolean(selectedClientId),
  })
  const currentStep: WorkflowStep = query.step
  const [paymentDraft, setPaymentDraft] = useState<ReturnType<typeof getPaymentDefaults> | null>(null)
  const [referralDrawerOpen, setReferralDrawerOpen] = useState(false)
  const [testTypeDrawerOpen, setTestTypeDrawerOpen] = useState(false)
  const [testTypeDrawerSelection, setTestTypeDrawerSelection] = useState('')
  const payment = paymentDraft ?? getPaymentDefaults(selectedBooking)
  const balanceDue = Math.max(0, payment.amountDue - payment.amountPaid)
  const paymentRecorded = Boolean(selectedBooking?.payment?.status)
  const suggestedClients = useMemo(() => {
    if (!selectedBooking) return []
    const queryParts = [
      selectedBooking.attendeeEmail,
      selectedBooking.attendeeName,
      selectedBooking.attendeePhone,
    ].filter(Boolean)

    return searchClients(allClients, queryParts.join(' '), 3)
  }, [allClients, selectedBooking])

  const handleSelectBooking = (booking: Booking) => {
    setPaymentDraft(getPaymentDefaults(booking))
    setQuery({
      bookingId: booking.id,
      step: getNextStep(booking),
    })
  }

  const handleRegisterClient = () => {
    if (!selectedBooking) return

    const params = new URLSearchParams({
      workflow: 'register-client',
      step: 'personalInfo',
      returnTo: 'guided',
      bookingId: selectedBooking.id,
    })

    router.push(`/admin/drug-test-upload?${params.toString()}`)
  }

  const handleUseExistingClient = (client: SimpleClient) => {
    if (!selectedBooking) return

    startTransition(async () => {
      await linkBookingToClient(selectedBooking.id, client.id)
      setPaymentDraft(null)
      const result = await refetchBookings()
      const updatedBooking = result.data?.find((booking) => booking.id === selectedBooking.id)

      if (!updatedBooking?.client) {
        toast.error('Client could not be linked. Try again or search manually.')
        setQuery({ step: 'registration', bookingId: selectedBooking.id })
        return
      }

      toast.success(`${client.fullName ?? `${client.firstName} ${client.lastName}`} linked to booking`)
      setQuery({ step: updatedBooking.needsTestType ? 'registration' : 'payment', bookingId: selectedBooking.id })
    })
  }

  const handleSelectTestType = (testTypeId: string, options?: { closeDrawer?: boolean; nextStep?: WorkflowStep }) => {
    if (!selectedBooking) return

    startTransition(async () => {
      const result = await setBookingScheduledTestType(selectedBooking.id, testTypeId)

      if (!result.success) {
        toast.error(result.error || 'Failed to set test type')
        return
      }

      const refreshed = await refetchBookings()
      const updatedBooking = refreshed.data?.find((booking) => booking.id === selectedBooking.id)
      setPaymentDraft(updatedBooking ? getPaymentDefaults(updatedBooking) : null)
      if (options?.closeDrawer) {
        setTestTypeDrawerOpen(false)
      }
      toast.success('Appointment test updated')
      setQuery({ step: options?.nextStep ?? 'payment', bookingId: selectedBooking.id })
    })
  }

  const openTestTypeDrawer = () => {
    setTestTypeDrawerSelection(selectedBooking?.bookingTestType?.id ?? selectedBooking?.testType?.id ?? '')
    setTestTypeDrawerOpen(true)
  }

  const handlePaymentNext = () => {
    if (!selectedBooking?.testType) return
    if (!payment.choice) {
      toast.error('Select a payment status before continuing.')
      return
    }

    const persistedPayment = getPersistedPayment(payment)
    if (payment.choice === 'still-owes' && payment.amountPaid >= payment.amountDue) {
      toast.error('Use Paid if the full amount was collected.')
      return
    }

    startTransition(async () => {
      const result = await recordBookingPayment({
        bookingId: selectedBooking.id,
        amountDue: payment.amountDue,
        amountPaid: persistedPayment.amountPaid,
        method: persistedPayment.method,
        status: persistedPayment.status,
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to record payment')
        return
      }

      setPaymentDraft(null)
      await refetchBookings()
      setQuery({ step: 'toxaccess', bookingId: selectedBooking.id })
    })
  }

  const handleContinueToCollection = () => {
    if (!selectedBooking?.testType || !selectedBooking.client?.id) return

    startTransition(async () => {
      const context = await refreshBookingClientContext(selectedBooking.id)

      if (context.needsRegistration || !context.clientId) {
        toast.error('Select or register the client before collection.')
        await refetchBookings()
        setQuery({ step: 'registration', bookingId: selectedBooking.id })
        return
      }

      if (context.needsTestType || !context.testType) {
        toast.error('Select the test type for this appointment before collection.')
        await refetchBookings()
        setQuery({ step: 'registration', bookingId: selectedBooking.id })
        return
      }

      router.push(getCollectionRoute(context.testType, context.clientId, selectedBooking.id))
    })
  }

  const goBackOneStep = () => {
    if (currentStep === 'schedule') {
      onBack()
      return
    }

    if (currentStep === 'toxaccess') {
      setQuery({ step: 'payment' })
      return
    }

    setQuery({ step: 'schedule' })
  }

  const renderHeader = (eyebrow: string, title = 'Complete Scheduled Collection') => (
    <div className="pb-8">
      <div className="min-w-0 space-y-3">
        <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
      </div>
    </div>
  )

  const renderSelectedSummary = (booking: Booking) => {
    const amountDisplay = getAmountDisplay(booking)

    return (
      <Card className="rounded-lg">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-semibold">{booking.attendeeName}</p>
              <p className="text-muted-foreground text-base">{getBookingContactEmail(booking)}</p>
            </div>
            <Badge variant={booking.needsRegistration || booking.needsTestType ? 'secondary' : 'outline'}>
              {booking.sampleCollection?.status === 'collected'
                ? 'Collected'
                : booking.needsRegistration
                  ? 'Register'
                  : booking.needsTestType
                    ? 'Set test'
                    : getPaymentLabel(booking)}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-base">
            <div>
              <p className="text-muted-foreground text-sm font-medium uppercase">Time</p>
              <p>{formatTime(booking.startTime)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium uppercase">Gender</p>
              <p>{formatGender(booking.client?.gender)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium uppercase">Test</p>
              <p>{booking.testType?.label ?? 'Set after registration'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium uppercase">Amount</p>
              <div className="flex flex-wrap items-center gap-2">
                <span>{amountDisplay.amount}</span>
                {amountDisplay.badge && <Badge variant={amountDisplay.badgeVariant}>{amountDisplay.badge}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderPaymentReview = (booking: Booking) => {
    const amountDisplay = getAmountDisplay(booking)
    const prepaidTestLabel = booking.bookingTestType?.label ?? 'Unknown'
    const referralTestLabel = booking.referralTestType?.label ?? 'Not set'
    const todayTestLabel = booking.testType?.label ?? 'Not set'
    const referralLabel = booking.referral
      ? `${booking.referral.name}${booking.referral.type ? ` (${booking.referral.type})` : ''}`
      : 'Not set'
    const hasUnknownPrepaidTest = !booking.bookingTestType
    const hasTestMismatch =
      Boolean(booking.bookingTestType && booking.referralTestType) &&
      booking.bookingTestType?.value !== booking.referralTestType?.value
    const hasTodayTestDifference =
      Boolean(booking.bookingTestType && booking.testType) && booking.bookingTestType?.value !== booking.testType?.value
    const hasBalanceDifference = payment.amountPaid > 0 && payment.amountPaid < payment.amountDue
    const reviewRows = [
      { label: 'Appointment', value: `${formatTime(booking.startTime)} · ${formatGender(booking.client?.gender)}` },
      {
        label: 'Amount',
        value: amountDisplay.amount,
        badge: amountDisplay.badge,
        badgeVariant: amountDisplay.badgeVariant,
      },
      { label: 'Referral', value: referralLabel, subValue: `Default test: ${referralTestLabel}` },
      { label: 'Booking test', value: prepaidTestLabel },
      ...(hasTodayTestDifference
        ? [
            {
              label: "Today's test",
              value: todayTestLabel,
            },
          ]
        : []),
    ]

    return (
      <Card className={cn('rounded-lg', (hasUnknownPrepaidTest || hasTestMismatch) && 'border-amber-300')}>
        <CardHeader>
          <div className="min-w-0">
            <p className="text-2xl font-semibold">{booking.attendeeName}</p>
            <p className="text-muted-foreground text-base">{getBookingContactEmail(booking)}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {(hasUnknownPrepaidTest || hasTestMismatch || hasBalanceDifference) && (
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-1 text-sm">
                {hasUnknownPrepaidTest && <p>The prepaid booking test is unknown for this appointment.</p>}
                {hasTestMismatch && <p>The booking test does not match the current referral test.</p>}
                {hasBalanceDifference && (
                  <p>{currency.format(balanceDue)} remains due for today&apos;s selected test.</p>
                )}
              </div>
            </div>
          )}

          <div className="border-border bg-background/40 divide-border divide-y overflow-hidden rounded-lg border">
            {reviewRows.map((item) => (
              <div key={item.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr_auto] sm:items-center">
                <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{item.label}</p>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{item.value}</p>
                    {'subValue' in item && item.subValue && (
                      <p className="text-muted-foreground text-sm">{item.subValue}</p>
                    )}
                  </div>
                  {item.badge && <Badge variant={item.badgeVariant}>{item.badge}</Badge>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setReferralDrawerOpen(true)}>
              <FilePenLine className="mr-2 size-5" />
              Change Referral
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={openTestTypeDrawer}>
              <FlaskConical className="mr-2 size-5" />
              Change Today&apos;s Test
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderSchedule = () => (
    <div className="space-y-6">
      {renderHeader('Today')}
      <p className="text-muted-foreground max-w-2xl text-xl">
        Select the scheduled client who is ready for collection. Registration and payment happen before the sample step.
      </p>

      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <CalendarDays className="size-6" />
            Today&apos;s Schedule
          </CardTitle>
          <CardDescription className="text-base">
            Name, time, gender, payment status, and registration status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading appointments...</p>
          ) : bookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No Cal.com appointments scheduled for today.</p>
          ) : (
            bookings.map((booking) => {
              const paymentLabel = getPaymentLabel(booking)
              const needsRegistration = booking.needsRegistration
              const needsTestType = booking.needsTestType
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => handleSelectBooking(booking)}
                  className="border-border bg-card hover:bg-muted/50 focus-visible:ring-ring grid w-full grid-cols-[1fr_auto] gap-4 rounded-lg border p-5 text-left transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="min-w-0 space-y-1">
                    <span className="block text-xl font-semibold">{booking.attendeeName}</span>
                    <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-4" />
                        {formatTime(booking.startTime)}
                      </span>
                      <span>{formatGender(booking.client?.gender)}</span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-2">
                    <Badge
                      variant={paymentLabel === 'Unpaid' || paymentLabel === 'Still owes' ? 'outline' : 'default'}
                      className={cn(
                        paymentLabel === 'Still owes' && 'border-destructive text-destructive',
                        paymentLabel === 'Collected' && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {paymentLabel}
                    </Badge>
                    {needsRegistration && <Badge variant="secondary">Register</Badge>}
                    {needsTestType && <Badge variant="secondary">Set test</Badge>}
                  </span>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderLoading = (eyebrow: string) => (
    <div className="space-y-6">
      {renderHeader(eyebrow)}
      <Card className="rounded-lg">
        <CardContent className="text-muted-foreground p-8 text-xl">Loading booking...</CardContent>
      </Card>
    </div>
  )

  const renderMissingBooking = (eyebrow: string) => (
    <div className="space-y-6">
      {renderHeader(eyebrow)}
      <Card className="rounded-lg">
        <CardContent className="space-y-4 p-8">
          <p className="text-muted-foreground text-xl">
            This booking is no longer available. Return to today&apos;s schedule and select the client again.
          </p>
          <Button type="button" onClick={() => setQuery({ step: 'schedule', bookingId: null })} size="lg">
            Back to Today&apos;s Schedule
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderRegistration = () => {
    if (isLoading) return renderLoading('Registration')
    if (!selectedBooking) return renderSchedule()
    const clientLinked = Boolean(selectedBooking.client)

    return (
      <div className="space-y-6">
        {renderHeader(
          clientLinked ? 'Test Type' : 'Registration',
          clientLinked ? 'Set Appointment Test' : 'Confirm Client',
        )}
        {renderSelectedSummary(selectedBooking)}

        {clientLinked && selectedBooking.needsTestType && (
          <Card className="rounded-lg border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <FlaskConical className="size-6" />
                What test is needed today?
              </CardTitle>
              <CardDescription className="text-base">
                This is saved on the appointment. It does not require changing the referral.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {testTypes.length === 0 ? (
                <p className="text-muted-foreground text-base">No active test types are available.</p>
              ) : (
                testTypes.map((testType) => (
                  <button
                    key={testType.id}
                    type="button"
                    onClick={() => handleSelectTestType(testType.id)}
                    disabled={isPending}
                    className="border-border bg-background hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-lg border p-5 text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-xl font-semibold">{testType.label}</span>
                      <span className="text-muted-foreground block text-base capitalize">{testType.category}</span>
                    </span>
                    <span className="text-xl font-semibold">{currency.format(testType.price)}</span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <Card className={cn('rounded-lg', !clientLinked && 'border-amber-300')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <UserCheck className="size-6" />
              {clientLinked ? 'Wrong client linked?' : 'Is this client already registered?'}
            </CardTitle>
            <CardDescription className="text-base">
              {clientLinked
                ? 'Search and select the correct client if this appointment was linked incorrectly.'
                : 'Link an existing client when there is a match. Only register if this is truly a new client.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!clientLinked && suggestedClients.length > 0 && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Possible Matches</p>
                {suggestedClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleUseExistingClient(client)}
                    className="border-border bg-background hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span>
                      <span className="block text-xl font-semibold">{client.fullName}</span>
                      <span className="text-muted-foreground block text-base">
                        {client.email}
                        {client.phone ? ` · ${client.phone}` : ''}
                      </span>
                    </span>
                    <span className="text-sm font-medium">Select</span>
                  </button>
                ))}
              </div>
            )}

            <ClientSearchDialog
              allClients={allClients}
              selectedClientId={selectedBooking.client?.id ?? ''}
              onSelect={handleUseExistingClient}
            >
              <Button type="button" variant="outline" className="w-full" size="lg">
                <Search className="mr-2 size-5" />
                Search Existing Clients
              </Button>
            </ClientSearchDialog>

            {!clientLinked && (
              <Button type="button" onClick={handleRegisterClient} className="w-full" size="lg">
                <UserPlus className="mr-2 size-5" />
                Register New Client
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderPayment = () => {
    if (isLoading) return renderLoading('Payment')
    if (selectedBooking?.needsRegistration || selectedBooking?.needsTestType) return renderRegistration()
    if (!selectedBooking || !selectedBooking.testType) return renderMissingBooking('Payment')

    return (
      <div className="space-y-6">
        {renderHeader('Review & Payment', 'Review and Payment')}
        {renderPaymentReview(selectedBooking)}

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <CreditCard className="size-6" />
              Payment Required
            </CardTitle>
            <CardDescription className="text-lg">{currency.format(payment.amountDue)} due today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base">Payment status</Label>
              <RadioGroup
                value={payment.choice ?? ''}
                onValueChange={(value) => {
                  const choice = value as PaymentChoice
                  setPaymentDraft((current) => {
                    const next = current ?? payment
                    const maxPartialPayment = Math.max(0, next.amountDue - 1)
                    const stillOwesAmountPaid = Math.max(0, Math.min(next.amountPaid, maxPartialPayment))
                    return {
                      ...next,
                      choice,
                      amountPaid: choice === 'still-owes' ? stillOwesAmountPaid : next.amountDue,
                    }
                  })
                }}
                className="gap-3"
              >
                {[
                  {
                    value: 'paid',
                    label: 'Paid',
                    description:
                      payment.method === 'pre-paid'
                        ? 'Already paid through the booking.'
                        : 'Payment collected now or already covered by the booking.',
                  },
                  { value: 'still-owes', label: 'Still owes', description: 'Partial payment or balance remains.' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`payment-${option.value}`}
                    className={cn(
                      'border-border bg-background hover:bg-muted/40 flex cursor-pointer items-start gap-4 rounded-lg border p-5 transition',
                      payment.choice === option.value && 'border-foreground bg-muted/50',
                    )}
                  >
                    <RadioGroupItem value={option.value} id={`payment-${option.value}`} className="mt-1" />
                    <span className="space-y-0.5">
                      <span className="block text-lg font-semibold">{option.label}</span>
                      <span className="text-muted-foreground block text-base font-normal">{option.description}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {payment.choice === 'still-owes' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount-paid">Amount paid</Label>
                  <Input
                    id="amount-paid"
                    type="number"
                    min={0}
                    max={payment.amountDue}
                    value={payment.amountPaid}
                    onChange={(event) => {
                      const amountPaid = Number(event.target.value || 0)
                      setPaymentDraft((current) => {
                        const next = current ?? payment
                        if (next.amountDue > 0 && amountPaid >= next.amountDue) {
                          return {
                            ...next,
                            choice: 'paid',
                            amountPaid: next.amountDue,
                          }
                        }

                        return {
                          ...next,
                          amountPaid,
                        }
                      })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance-due">Balance due</Label>
                  <Input id="balance-due" value={currency.format(balanceDue)} readOnly />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderToxAccess = () => {
    if (isLoading) return renderLoading('ToxAccess')
    if (selectedBooking?.needsRegistration || selectedBooking?.needsTestType) return renderRegistration()
    if (!selectedBooking) return renderMissingBooking('ToxAccess')
    const client = selectedBooking.client
    const isFirstTest = !client?.firstDrugTestDate
    const intakeDate = client?.firstDrugTestDate
      ? formatDateOnly(client.firstDrugTestDate)
      : formatDateOnly(new Date().toISOString())
    const fullName = getToxAccessName(selectedBooking, isFirstTest)
    const toxAccessRows: Array<{ label: string; value: string }> = isFirstTest
      ? [
          ['Name', fullName],
          ['DOB', formatDateOnly(client?.dob)],
          ['Sex', formatGender(client?.gender)],
          ['Intake Date', intakeDate],
          ['Active', 'Yes'],
          ['Phone', client?.phone || selectedBooking.attendeePhone || 'Unknown'],
          ['Agency', '(310872) MI Drug Test llc - MI'],
          ['Test Code', getToxAccessTestValue(selectedBooking.testType)],
        ].map(([label, value]) => ({ label, value }))
      : [
          { label: 'Name', value: fullName },
          {
            label: selectedBooking.testType?.category === 'lab' ? 'Test Code' : 'Test',
            value: getToxAccessTestValue(selectedBooking.testType),
          },
        ]

    return (
      <div className="space-y-5">
        {renderHeader('ToxAccess', 'Collect Sample in ToxAccess')}
        {renderSelectedSummary(selectedBooking)}

        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <ClipboardList className="size-6" />
              {isFirstTest ? 'First-Test ToxAccess Setup' : 'ToxAccess Reference'}
            </CardTitle>
            <CardDescription className="text-base">
              {isFirstTest
                ? 'Use these values when creating this client in ToxAccess.'
                : 'Use these values to find the client and select the test.'}
            </CardDescription>
          </CardHeader>
          <CardContent className={cn('grid gap-3', isFirstTest && 'sm:grid-cols-2')}>
            {toxAccessRows.map(({ label, value }) => (
              <div
                key={label}
                className={cn(
                  'border-border bg-background grid gap-1 rounded-lg border p-4',
                  !isFirstTest && 'sm:grid-cols-[140px_1fr] sm:items-center',
                  label === 'Agency' && 'sm:col-span-2',
                  label === 'Test Code' && 'sm:col-span-2',
                )}
              >
                <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="flex min-h-[180px] items-center justify-center gap-6 p-6">
            <div className="bg-muted flex size-24 shrink-0 items-center justify-center rounded-full">
              <FlaskConical className="text-primary size-14" strokeWidth={1.75} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Collect in ToxAccess</h2>
              <p className="text-muted-foreground text-xl">Then continue here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderCurrentStep = () => {
    if (currentStep === 'registration') return renderRegistration()
    if (currentStep === 'payment') return renderPayment()
    if (currentStep === 'toxaccess') return renderToxAccess()
    return renderSchedule()
  }

  const referralPreviewData = referralProfile
    ? referralProfile
    : selectedBooking?.client
      ? {
          referralType: selectedBooking.client.referralType ?? 'self',
          referralTitle: selectedBooking.referral?.name ?? 'Self',
          referralEmails: [],
          referralRecipientsDetailed: [],
          clientAdditionalRecipientsDetailed: [],
          hasExplicitReferralRecipients: false,
        }
      : null
  const selectedDrawerTestType = testTypes.find((testType) => testType.id === testTypeDrawerSelection) ?? null
  const drawerCurrentPrice = selectedBooking?.testType?.price ?? null
  const drawerPriceDifference =
    selectedDrawerTestType && drawerCurrentPrice !== null ? selectedDrawerTestType.price - drawerCurrentPrice : 0

  const nextLabel = currentStep === 'toxaccess' ? 'Continue Collection' : 'Next'
  const canGoNext =
    currentStep === 'payment'
      ? Boolean(selectedBooking?.testType && payment.choice)
      : currentStep === 'toxaccess'
        ? Boolean(paymentRecorded && selectedBooking?.testType && selectedBooking.client?.id)
        : false

  const backLabel = currentStep === 'schedule' ? 'Cancel' : 'Back'

  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-col px-2">
        {renderCurrentStep()}

        <div className="mt-8 flex items-center justify-between border-t pt-4">
          <Button
            type="button"
            onClick={goBackOneStep}
            variant="outline"
            disabled={isPending}
            size="lg"
            data-testid="wizard-back-button"
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            {backLabel}
          </Button>

          {currentStep !== 'schedule' && (
            <Button
              type="button"
              onClick={currentStep === 'payment' ? handlePaymentNext : handleContinueToCollection}
              disabled={!canGoNext || isPending}
              size="lg"
              data-testid="wizard-next-button"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {nextLabel}
                  {currentStep === 'toxaccess' ? (
                    <CheckCircle2 className="ml-2 h-5 w-5" />
                  ) : (
                    <ChevronRight className="ml-2 h-5 w-5" />
                  )}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <ReferralProfileDrawer
        open={referralDrawerOpen}
        onOpenChange={setReferralDrawerOpen}
        clientId={selectedClientId}
        previewData={referralPreviewData}
        fallbackReferralEmails={referralProfile?.referralEmails ?? []}
        onSaved={() => {
          setPaymentDraft(null)
          void refetchBookings()
          void refetchReferralProfile()
        }}
      />

      <Drawer direction="right" open={testTypeDrawerOpen} onOpenChange={setTestTypeDrawerOpen}>
        <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(36rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader className="border-border border-b px-6 py-5">
            <DrawerTitle className="text-2xl tracking-tight">Change Today&apos;s Test</DrawerTitle>
            <DrawerDescription>
              Updates only this appointment so pricing and collection stay aligned for today.
            </DrawerDescription>
          </DrawerHeader>

          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {testTypes.map((testType) => {
              const isSelected = testTypeDrawerSelection === testType.id
              const isCurrentBookingTest = selectedBooking?.bookingTestType?.id === testType.id
              const isReferralDefault =
                !selectedBooking?.bookingTestType && selectedBooking?.referralTestType?.id === testType.id

              return (
                <button
                  key={testType.id}
                  type="button"
                  onClick={() => setTestTypeDrawerSelection(testType.id)}
                  className={cn(
                    'border-border bg-background hover:bg-muted/40 focus-visible:ring-ring flex w-full items-start justify-between gap-4 rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none',
                    isSelected && 'border-foreground bg-muted/50',
                  )}
                >
                  <span className="min-w-0 space-y-1">
                    <span className="block text-lg font-semibold">{testType.label}</span>
                    <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm capitalize">
                      <span>{testType.category}</span>
                      {isCurrentBookingTest && <Badge variant="secondary">Current appointment</Badge>}
                      {isReferralDefault && <Badge variant="secondary">Referral default</Badge>}
                    </span>
                  </span>
                  <span className="text-lg font-semibold">{currency.format(testType.price)}</span>
                </button>
              )
            })}

            {selectedDrawerTestType && drawerPriceDifference !== 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                {drawerPriceDifference > 0
                  ? `${currency.format(drawerPriceDifference)} more will be due for this test.`
                  : `${currency.format(Math.abs(drawerPriceDifference))} less than the current selected test.`}
              </div>
            )}
          </div>

          <DrawerFooter className="border-border border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setTestTypeDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!testTypeDrawerSelection || isPending}
              onClick={() => handleSelectTestType(testTypeDrawerSelection, { closeDrawer: true, nextStep: 'payment' })}
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Test
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

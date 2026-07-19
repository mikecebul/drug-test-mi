'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Ellipsis,
  FilePenLine,
  FlaskConical,
  Loader2,
  ClipboardList,
  Search,
  Trash2Icon,
  TriangleAlert,
  Undo2,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { APP_TIMEZONE, formatDobInput } from '@/lib/date-utils'
import { cn } from '@/utilities/cn'
import { RegisterClientDialog } from '../../components/RegisterClientDialog'
import type { ClientMatch } from '../../types'
import { ClientSearchDialog } from '../components/client/ClientSearchDialog'
import type { SimpleClient } from '../components/client/getClients'
import { useClientSearch } from '../components/client/useClientSearch'
import {
  cancelAndRefundGuidedBooking,
  cancelGuidedBooking,
  createWalkInBooking,
  getActiveCollectionTestTypes,
  getClientOutstandingPaymentBalances,
  getClientReferralProfile,
  getTodaysCollectionBookings,
  linkBookingToClient,
  recordBookingPayment,
  refreshBookingClientContext,
  setBookingScheduledTestType,
  undoBookingPayment,
} from './actions'
import {
  doesGuidedBookingNameMatchClient,
  formatGuidedGender,
  getGuidedBookingNextStep,
  getGuidedClientName,
  getGuidedGenderBadgeClass,
  getGuidedPaymentLabel,
} from './schedule-utils'
import {
  buildGuidedPaymentAllocationPreview,
  compactPreviousPaymentAllocations,
  getGuidedCreditMaximum,
  getGuidedPaymentQuickAmounts,
  isValidGuidedCreditAmount,
  isValidGuidedPaymentAmount,
  parseGuidedPaymentAmount,
  type GuidedPaymentEntryMethod,
} from './payment-state'
import { ReferralProfileDrawer } from '../components/emails/referrals/ReferralProfileDrawer'
import { WalkInClientDrawer } from './WalkInClientDrawer'

type Booking = Awaited<ReturnType<typeof getTodaysCollectionBookings>>[number]
type TestType = NonNullable<Booking['testType']>
type WorkflowStep = 'schedule' | 'registration' | 'payment' | 'toxaccess'
type ScheduleAction = 'cancel' | 'cancel-refund'

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

function formatDateOnly(value?: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  }).format(new Date(value))
}

function getPaymentDefaults(booking: Booking | null) {
  const amountDue = booking?.testType?.price ?? 0
  const existing = booking?.payment
  const existingAmountPaid = Math.min(
    amountDue,
    typeof existing?.amountPaid === 'number' ? Math.max(0, existing.amountPaid) : 0,
  )
  const currentBalanceDue = Math.max(0, amountDue - existingAmountPaid)
  const method: GuidedPaymentEntryMethod = existing?.method === 'card' ? 'card' : 'cash'

  return {
    amountDue,
    existingAmountPaid,
    currentBalanceDue,
    amountReceived: '0',
    creditToApply: '0',
    method,
  }
}

function getPaymentLabel(booking: Booking) {
  return getGuidedPaymentLabel(booking)
}

function getBookingContactEmail(booking: Booking) {
  return booking.client?.email || booking.attendeeEmail
}

function getClientSearchMatchLabel(client: SimpleClient) {
  const reason =
    client.matchReason === 'date-of-birth'
      ? 'date of birth'
      : client.matchReason === 'recent'
        ? 'recent client'
        : client.matchReason || 'identity'

  if (client.matchType === 'exact') return `Exact ${reason}`
  if (client.matchType === 'partial') return `Partial ${reason}`
  return `Possible ${reason} match`
}

function getClientIdentityMismatchKey(booking: Booking) {
  if (!booking.client || doesGuidedBookingNameMatchClient(booking.attendeeName, booking.client)) return null

  return [booking.id, booking.client.id, booking.attendeeName, getGuidedClientName(booking.client)].join(':')
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

function canRefundPrepaidBooking(booking: Booking) {
  return (
    booking.payment?.method === 'pre-paid' && booking.payment.status === 'paid' && (booking.payment.amountPaid ?? 0) > 0
  )
}

function getScheduleActionCopy(action: ScheduleAction, booking: Booking) {
  if (action === 'cancel-refund') {
    if (booking.sampleCollection?.status === 'collected') {
      return {
        title: 'Refund completed appointment',
        description: `${booking.attendeeName}'s collection stays completed, and the full Stripe prepayment will be refunded.`,
        confirmLabel: 'Refund prepayment',
      }
    }

    return {
      title: 'Cancel and refund appointment',
      description: `${booking.attendeeName}'s appointment will be cancelled and the full Stripe prepayment will be refunded.`,
      confirmLabel: 'Cancel and refund',
    }
  }

  return {
    title: 'Cancel appointment',
    description: `${booking.attendeeName}'s appointment will be cancelled.`,
    confirmLabel: 'Cancel appointment',
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
  const queryClient = useQueryClient()
  const [query, setQuery] = useQueryStates({
    step: parseAsStringLiteral(workflowSteps).withDefault('schedule'),
    bookingId: parseAsString,
  })
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['guided', 'today-bookings'],
    queryFn: () => getTodaysCollectionBookings(),
    refetchOnMount: 'always',
  })
  const { data: testTypes = [] } = useQuery({
    queryKey: ['guided', 'test-types'],
    queryFn: getActiveCollectionTestTypes,
  })
  const [isPending, startTransition] = useTransition()
  const [walkInClient, setWalkInClient] = useState<SimpleClient | null>(null)
  const [walkInClientDrawerOpen, setWalkInClientDrawerOpen] = useState(false)
  const [walkInRegistrationOpen, setWalkInRegistrationOpen] = useState(false)
  const [walkInTestTypeId, setWalkInTestTypeId] = useState('')
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === query.bookingId) ?? null,
    [bookings, query.bookingId],
  )
  const selectedClientId = selectedBooking?.client?.id ?? null
  const currentStep: WorkflowStep = query.step
  const { data: referralProfile = null, refetch: refetchReferralProfile } = useQuery({
    queryKey: ['guided', 'referral-profile', selectedClientId],
    queryFn: () => getClientReferralProfile(selectedClientId || ''),
    enabled: Boolean(selectedClientId),
  })
  const {
    data: outstandingPaymentBalances = [],
    isLoading: isLoadingOutstandingPaymentBalances,
    isError: hasOutstandingPaymentBalanceError,
  } = useQuery({
    queryKey: ['guided', 'outstanding-payment-balances', selectedClientId],
    queryFn: () => getClientOutstandingPaymentBalances(selectedClientId || ''),
    enabled: currentStep === 'payment' && Boolean(selectedClientId),
    refetchOnMount: 'always',
  })
  const [paymentDraft, setPaymentDraft] = useState<ReturnType<typeof getPaymentDefaults> | null>(null)
  const [showAdditionalPayment, setShowAdditionalPayment] = useState(false)
  const [undoPaymentDialogOpen, setUndoPaymentDialogOpen] = useState(false)
  const [noPaymentDialogOpen, setNoPaymentDialogOpen] = useState(false)
  const [verifiedClientMismatchKey, setVerifiedClientMismatchKey] = useState<string | null>(null)
  const [referralDrawerOpen, setReferralDrawerOpen] = useState(false)
  const [testTypeDrawerOpen, setTestTypeDrawerOpen] = useState(false)
  const [testTypeDrawerSelection, setTestTypeDrawerSelection] = useState('')
  const [scheduleAction, setScheduleAction] = useState<{ action: ScheduleAction; booking: Booking } | null>(null)
  const payment = paymentDraft ?? getPaymentDefaults(selectedBooking)
  const paymentAmountIsValid = isValidGuidedPaymentAmount(payment.amountReceived)
  const amountReceived = parseGuidedPaymentAmount(payment.amountReceived)
  const creditToApply = parseGuidedPaymentAmount(payment.creditToApply)
  const paymentTotalDue = outstandingPaymentBalances.reduce(
    (total, balance) => total + balance.balanceDue,
    payment.currentBalanceDue,
  )
  const creditAmountIsValid = isValidGuidedCreditAmount(
    payment.creditToApply,
    selectedBooking?.client?.creditBalance ?? 0,
    paymentTotalDue,
  )
  const paymentRecorded = Boolean(selectedBooking?.payment?.status)
  const selectedClientMismatchKey = selectedBooking ? getClientIdentityMismatchKey(selectedBooking) : null
  const clientIdentityIsVerified = !selectedClientMismatchKey || verifiedClientMismatchKey === selectedClientMismatchKey
  const refreshBookings = () =>
    queryClient.fetchQuery({
      queryKey: ['guided', 'today-bookings'],
      queryFn: () => getTodaysCollectionBookings(),
    })
  const bookingClientSearch = useClientSearch(
    {
      name: selectedBooking?.attendeeName,
      email: selectedBooking?.attendeeEmail,
      phone: selectedBooking?.attendeePhone,
      limit: 5,
    },
    {
      enabled: currentStep === 'registration' && Boolean(selectedBooking && !selectedBooking.client),
      debounceMs: 0,
    },
  )
  const exactBookingMatches = bookingClientSearch.data?.exactMatches ?? []
  const possibleBookingMatches = bookingClientSearch.data?.possibleMatches ?? []
  const selectedWalkInTestTypeId = walkInTestTypeId || testTypes[0]?.id || ''
  const selectedWalkInTestType = useMemo(
    () => testTypes.find((testType) => testType.id === selectedWalkInTestTypeId) ?? null,
    [testTypes, selectedWalkInTestTypeId],
  )

  const handleSelectBooking = (booking: Booking) => {
    setPaymentDraft(getPaymentDefaults(booking))
    setShowAdditionalPayment(false)
    setQuery({
      bookingId: booking.id,
      step: getNextStep(booking),
    })
  }

  const openExternalLink = (href: string | null | undefined) => {
    if (!href) return
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const handleConfirmScheduleAction = () => {
    if (!scheduleAction) return

    const { action, booking } = scheduleAction
    startTransition(async () => {
      const result =
        action === 'cancel-refund'
          ? await cancelAndRefundGuidedBooking({ bookingId: booking.id })
          : await cancelGuidedBooking({ bookingId: booking.id })

      if (!result.success) {
        toast.error(
          result.error || 'Appointment action failed.',
          result.fallbackHref
            ? {
                action: {
                  label: 'Open Cal.com',
                  onClick: () => openExternalLink(result.fallbackHref),
                },
              }
            : undefined,
        )
        return
      }

      if (result.warning) {
        toast.warning(
          result.warning,
          result.fallbackHref
            ? {
                action: {
                  label: 'Open Cal.com',
                  onClick: () => openExternalLink(result.fallbackHref),
                },
              }
            : undefined,
        )
      } else {
        toast.success(action === 'cancel-refund' ? 'Appointment cancelled and refunded' : 'Appointment cancelled')
      }

      setScheduleAction(null)
      setPaymentDraft(null)
      await refreshBookings()

      if (query.bookingId === booking.id) {
        setQuery({ step: 'schedule', bookingId: null })
      }
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
      const refreshedBookings = await refreshBookings()
      const updatedBooking = refreshedBookings.find((booking) => booking.id === selectedBooking.id)

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

      const refreshedBookings = await refreshBookings()
      const updatedBooking = refreshedBookings.find((booking) => booking.id === selectedBooking.id)
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

  const handleCreateWalkInBooking = () => {
    if (!walkInClient || !selectedWalkInTestTypeId) {
      toast.error('Select a client and test type first.')
      return
    }

    startTransition(async () => {
      const result = await createWalkInBooking({
        clientId: walkInClient.id,
        testTypeId: selectedWalkInTestTypeId,
      })

      if (!result.success || !result.bookingId) {
        toast.error(result.error || 'Failed to create walk-in collection.')
        return
      }

      setPaymentDraft(null)
      await refreshBookings()
      toast.success('Walk-in collection created')
      setQuery({ bookingId: result.bookingId, step: 'payment' })
    })
  }

  const handleWalkInClientCreated = (client: ClientMatch) => {
    const fullName = [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ')

    setWalkInClient({
      id: client.id,
      firstName: client.firstName,
      middleInitial: client.middleInitial ?? undefined,
      lastName: client.lastName,
      fullName,
      initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`,
      email: client.email,
      dob: client.dob ?? undefined,
      headshot: client.headshot ?? undefined,
      matchType: client.matchType,
      score: client.score,
    })
    toast.success(`${fullName} selected for this walk-in`)
  }

  const handleOpenWalkInRegistration = () => {
    setWalkInClientDrawerOpen(false)
    setWalkInRegistrationOpen(true)
  }

  const handlePaymentNext = (confirmedNoPayment = false) => {
    if (!selectedBooking?.testType) return
    if (!selectedBooking.client?.id) {
      toast.error('Select or register the client before recording payment.')
      return
    }
    if (!clientIdentityIsVerified) {
      toast.error('Verify the selected client before continuing.')
      return
    }
    if (!paymentAmountIsValid) {
      toast.error('Enter zero or a positive amount received.')
      return
    }
    if (!creditAmountIsValid) {
      toast.error('Client credit cannot exceed the available credit or total balance due.')
      return
    }
    if (isLoadingOutstandingPaymentBalances) {
      toast.error('Wait for the existing balances to finish loading.')
      return
    }
    if (hasOutstandingPaymentBalanceError) {
      toast.error('Existing balances could not be loaded. Refresh and try again.')
      return
    }
    if (amountReceived === 0 && creditToApply === 0 && paymentTotalDue > 0 && !confirmedNoPayment) {
      setNoPaymentDialogOpen(true)
      return
    }
    const clientId = selectedBooking.client.id

    setNoPaymentDialogOpen(false)
    startTransition(async () => {
      const result = await recordBookingPayment({
        bookingId: selectedBooking.id,
        amountReceived,
        creditApplied: creditToApply,
        method: payment.method,
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to record payment')
        return
      }

      setPaymentDraft(null)
      setShowAdditionalPayment(false)
      await Promise.all([
        refreshBookings(),
        queryClient.invalidateQueries({
          queryKey: ['guided', 'outstanding-payment-balances', clientId],
        }),
      ])
      setQuery({ step: 'toxaccess', bookingId: selectedBooking.id })
    })
  }

  const handleUndoPayment = () => {
    if (!selectedBooking?.client?.id) return
    const clientId = selectedBooking.client.id

    startTransition(async () => {
      const result = await undoBookingPayment({ bookingId: selectedBooking.id })
      if (!result.success) {
        toast.error(result.error || 'Unable to undo this payment.')
        return
      }

      setUndoPaymentDialogOpen(false)
      setShowAdditionalPayment(false)
      const refreshedBookings = await refreshBookings()
      const updatedBooking = refreshedBookings.find((booking) => booking.id === selectedBooking.id)
      setPaymentDraft(updatedBooking ? getPaymentDefaults(updatedBooking) : null)
      await queryClient.invalidateQueries({
        queryKey: ['guided', 'outstanding-payment-balances', clientId],
      })
      toast.success('Payment undone and balances restored')
    })
  }

  const handleContinueToCollection = () => {
    if (!selectedBooking?.testType || !selectedBooking.client?.id) return
    if (!clientIdentityIsVerified) {
      toast.error('Verify the selected client before continuing.')
      return
    }

    startTransition(async () => {
      const context = await refreshBookingClientContext(selectedBooking.id)

      if (context.needsRegistration || !context.clientId) {
        toast.error('Select or register the client before collection.')
        await refreshBookings()
        setQuery({ step: 'registration', bookingId: selectedBooking.id })
        return
      }

      if (context.needsTestType || !context.testType) {
        toast.error('Select the test type for this appointment before collection.')
        await refreshBookings()
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

  const renderClientIdentityMismatch = (booking: Booking) => {
    const mismatchKey = getClientIdentityMismatchKey(booking)
    if (!mismatchKey || !booking.client) return null

    const selectedClientName = getGuidedClientName(booking.client) || 'Unknown client'
    const confirmationId = `verify-client-identity-${booking.id}`
    const isConfirmed = verifiedClientMismatchKey === mismatchKey

    return (
      <Alert variant="destructive" data-testid="client-identity-mismatch">
        <TriangleAlert />
        <AlertTitle>Booking name does not match the selected client</AlertTitle>
        <AlertDescription>
          <p>
            Booked as <strong>{booking.attendeeName}</strong>, but the selected client is{' '}
            <strong>{selectedClientName}</strong>.
          </p>
          <p>Change the client if this is wrong. Otherwise, verify their identity before continuing.</p>
          <Field orientation="horizontal" className="mt-3 rounded-md border border-current/30 p-3">
            <Checkbox
              id={confirmationId}
              checked={isConfirmed}
              onCheckedChange={(checked) => setVerifiedClientMismatchKey(checked === true ? mismatchKey : null)}
            />
            <FieldLabel htmlFor={confirmationId} className="cursor-pointer font-normal">
              I verified {selectedClientName} is the person testing today.
            </FieldLabel>
          </Field>
        </AlertDescription>
      </Alert>
    )
  }

  const renderSelectedSummary = (booking: Booking) => {
    const amountDisplay = getAmountDisplay(booking)
    const selectedClientName = getGuidedClientName(booking.client)
    const displayName = selectedClientName || booking.attendeeName

    return (
      <Card className="rounded-lg">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                {booking.client ? 'Selected client' : 'Booking attendee'}
              </p>
              <p className="text-2xl font-semibold">{displayName}</p>
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
          {renderClientIdentityMismatch(booking)}
          <div className="grid grid-cols-2 gap-4 text-base">
            <div>
              <p className="text-muted-foreground text-sm font-medium uppercase">Time</p>
              <p>{formatTime(booking.startTime)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium uppercase">Gender</p>
              <p>{formatGuidedGender(booking.client?.gender)}</p>
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
    const selectedClientName = getGuidedClientName(booking.client) || 'No client selected'
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
    const hasBalanceDifference = payment.existingAmountPaid > 0 && payment.currentBalanceDue > 0
    const reviewRows = [
      { label: 'Appointment', value: formatTime(booking.startTime) },
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
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Selected client</p>
              <p className="text-2xl font-semibold">{selectedClientName}</p>
              <p className="text-muted-foreground text-base">{getBookingContactEmail(booking)}</p>
            </div>
            <Badge variant="outline" className={cn('mt-1 shrink-0', getGuidedGenderBadgeClass(booking.client?.gender))}>
              {formatGuidedGender(booking.client?.gender)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {renderClientIdentityMismatch(booking)}
          {(hasUnknownPrepaidTest || hasTestMismatch || hasBalanceDifference) && (
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-1 text-sm">
                {hasUnknownPrepaidTest && <p>The prepaid booking test is unknown for this appointment.</p>}
                {hasTestMismatch && <p>The booking test does not match the current referral test.</p>}
                {hasBalanceDifference && (
                  <p>{currency.format(payment.currentBalanceDue)} remains due for today&apos;s selected test.</p>
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
            <ClientSearchDialog selectedClientId={booking.client?.id ?? ''} onSelect={handleUseExistingClient}>
              <Button type="button" variant="outline" size="lg" className="w-full">
                <UserCheck className="mr-2 size-5" />
                Change Client
              </Button>
            </ClientSearchDialog>
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleRegisterClient}>
              <UserPlus data-icon="inline-start" />
              Register New Client
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setReferralDrawerOpen(true)}
            >
              <FilePenLine className="mr-2 size-5" />
              Change Referral
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={openTestTypeDrawer}>
              <FlaskConical className="mr-2 size-5" />
              Change Today&apos;s Test
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderSchedule = () => {
    const actionCopy = scheduleAction ? getScheduleActionCopy(scheduleAction.action, scheduleAction.booking) : null

    return (
      <div className="space-y-6">
        {renderHeader('Today')}
        <p className="text-muted-foreground max-w-2xl text-xl">
          Select the scheduled client who is ready for collection. Registration and payment happen before the sample
          step.
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
                const canRefund = canRefundPrepaidBooking(booking)
                const isCompleted = booking.sampleCollection?.status === 'collected'
                return (
                  <div
                    key={booking.id}
                    className={cn(
                      'border-border bg-card grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-lg border p-5 transition',
                      isCompleted ? 'border-border/60 bg-muted/40 text-muted-foreground' : 'hover:bg-muted/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectBooking(booking)}
                      disabled={isCompleted}
                      className="hover:text-foreground focus-visible:ring-ring min-w-0 space-y-1 rounded-md text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'block text-xl font-semibold',
                            isCompleted && 'line-through decoration-current/60 decoration-1',
                          )}
                        >
                          {booking.attendeeName}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0',
                            getGuidedGenderBadgeClass(booking.client?.gender),
                            isCompleted && 'opacity-70',
                          )}
                        >
                          {formatGuidedGender(booking.client?.gender)}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            isCompleted && 'line-through decoration-current/60 decoration-1',
                          )}
                        >
                          <Clock className="size-4" />
                          {formatTime(booking.startTime)}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant={
                            isCompleted
                              ? 'secondary'
                              : paymentLabel === 'Paid' || paymentLabel === 'Pre-paid' || paymentLabel === 'Collected'
                                ? 'success'
                                : paymentLabel === 'Unpaid' || paymentLabel === 'Still owes'
                                  ? 'outline'
                                  : 'default'
                          }
                          className={cn(paymentLabel === 'Still owes' && 'border-destructive text-destructive')}
                        >
                          {isCompleted && <CheckCircle2 data-icon="inline-start" />}
                          {isCompleted ? 'Completed' : paymentLabel}
                        </Badge>
                        {needsRegistration && <Badge variant="secondary">Register</Badge>}
                        {needsTestType && <Badge variant="secondary">Set test</Badge>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="-mt-2 -mr-2"
                              aria-label={`${booking.attendeeName} appointment options`}
                            />
                          }
                        >
                          <Ellipsis className="size-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              disabled={isCompleted || !booking.calcomActionLinks?.rescheduleHref}
                              closeOnClick={false}
                              onClick={() => openExternalLink(booking.calcomActionLinks?.rescheduleHref)}
                            >
                              <CalendarClock className="size-4" />
                              Reschedule
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isCompleted}
                              variant="destructive"
                              closeOnClick={false}
                              onClick={() => setScheduleAction({ action: 'cancel', booking })}
                            >
                              <Ban className="size-4" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              disabled={!canRefund}
                              variant="destructive"
                              closeOnClick={false}
                              onClick={() => {
                                if (canRefund) setScheduleAction({ action: 'cancel-refund', booking })
                              }}
                            >
                              <CreditCard className="size-4" />
                              Cancel and refund
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card data-testid="guided-walk-in-card" className="overflow-hidden rounded-lg">
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger
              nativeButton={false}
              render={
                <CardHeader className="group hover:bg-muted/50 focus-visible:ring-ring flex cursor-pointer flex-row items-center gap-4 p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none" />
              }
            >
              <div className="bg-muted text-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
                <UserCheck className="size-6" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                <CardTitle className="text-2xl">Walk-In Collection</CardTitle>
                <CardDescription className="text-base">For clients without an appointment</CardDescription>
              </div>
              <ChevronDown className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-data-panel-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsiblePanel className="border-border border-t">
              <CardContent className="p-5">
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel htmlFor="walk-in-client-trigger">Client</FieldLabel>
                    <Button
                      id="walk-in-client-trigger"
                      type="button"
                      aria-label={walkInClient ? 'Change client' : 'Choose client'}
                      variant="outline"
                      size="clear"
                      className="h-auto min-h-20 w-full justify-start gap-3 p-4 text-left"
                      onClick={() => setWalkInClientDrawerOpen(true)}
                    >
                      {walkInClient ? (
                        <Avatar className="size-11">
                          <AvatarImage
                            src={walkInClient.headshot}
                            alt={walkInClient.fullName || `${walkInClient.firstName} ${walkInClient.lastName}`}
                          />
                          <AvatarFallback className="font-semibold">{walkInClient.initials}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-lg">
                          <Search />
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                        <span className="truncate text-base font-semibold">
                          {walkInClient
                            ? walkInClient.fullName || `${walkInClient.firstName} ${walkInClient.lastName}`
                            : 'None selected'}
                        </span>
                        {walkInClient && (
                          <span className="text-muted-foreground max-w-full truncate text-sm font-normal">
                            {walkInClient.email}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        {walkInClient ? 'Change client' : 'Choose client'}
                        <ChevronRight data-icon="inline-end" />
                      </span>
                    </Button>
                  </Field>

                  <Separator />

                  <Field>
                    <FieldLabel htmlFor="walk-in-test-type">Test type</FieldLabel>
                    <Select
                      items={testTypes.map((testType) => ({
                        value: testType.id,
                        label: `${testType.label} · ${currency.format(testType.price)}`,
                      }))}
                      value={selectedWalkInTestTypeId}
                      onValueChange={(value) => setWalkInTestTypeId(value ?? '')}
                    >
                      <SelectTrigger id="walk-in-test-type" className="h-12 w-full text-base">
                        <SelectValue placeholder="Select test type" />
                      </SelectTrigger>
                      <SelectContent
                        side="bottom"
                        align="start"
                        alignItemWithTrigger={false}
                        sideOffset={4}
                        collisionAvoidance={{ side: 'none', align: 'none', fallbackAxisSide: 'none' }}
                      >
                        <SelectGroup>
                          {testTypes.map((testType) => (
                            <SelectItem key={testType.id} value={testType.id}>
                              {testType.label} · {currency.format(testType.price)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="p-5 pt-0">
                <Button
                  type="button"
                  onClick={handleCreateWalkInBooking}
                  disabled={!walkInClient || !selectedWalkInTestType || isPending}
                  size="xl"
                  className="w-full"
                >
                  {isPending ? <Loader2 className="animate-spin" /> : <CalendarDays />}
                  Start Guided Test
                </Button>
              </CardFooter>
            </CollapsiblePanel>
          </Collapsible>
        </Card>
        <WalkInClientDrawer
          open={walkInClientDrawerOpen}
          onOpenChange={setWalkInClientDrawerOpen}
          onRegister={handleOpenWalkInRegistration}
          onSelect={setWalkInClient}
          selectedClientId={walkInClient?.id ?? ''}
        />
        <RegisterClientDialog
          open={walkInRegistrationOpen}
          onOpenChange={setWalkInRegistrationOpen}
          onClientCreated={handleWalkInClientCreated}
        />
        <Dialog open={Boolean(scheduleAction)} onOpenChange={(open) => !open && setScheduleAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionCopy?.title}</DialogTitle>
              <DialogDescription>{actionCopy?.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setScheduleAction(null)} disabled={isPending}>
                Keep appointment
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirmScheduleAction} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {actionCopy?.confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

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
            {!clientLinked && bookingClientSearch.isFetching && (
              <div className="text-muted-foreground flex items-center gap-3 rounded-lg border p-4 text-base">
                <Loader2 className="size-5 animate-spin" />
                Checking whether this booking matches a registered client...
              </div>
            )}

            {!clientLinked && bookingClientSearch.isError && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Automatic client check failed</AlertTitle>
                <AlertDescription>
                  Search existing clients before registering so a duplicate profile is not created.
                </AlertDescription>
              </Alert>
            )}

            {!clientLinked && exactBookingMatches.length > 0 && (
              <Alert className="border-success/50 bg-success/10">
                <UserCheck />
                <AlertTitle>Registered client found</AlertTitle>
                <AlertDescription>
                  This appointment matches an account created after booking. Confirm the identity, then select the
                  client.
                </AlertDescription>
              </Alert>
            )}

            {!clientLinked && exactBookingMatches.length > 0 && (
              <div className="space-y-3" data-testid="guided-exact-client-matches">
                <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Exact Matches</p>
                {exactBookingMatches.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleUseExistingClient(client)}
                    disabled={isPending}
                    className="border-success/50 bg-success/5 hover:bg-success/10 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-xl font-semibold">{client.fullName}</span>
                      <span className="text-muted-foreground block text-base">
                        {client.email}
                        {client.phone ? ` · ${client.phone}` : ''}
                      </span>
                      <Badge variant="success" className="mt-2">
                        {getClientSearchMatchLabel(client)}
                      </Badge>
                    </span>
                    <span className="text-sm font-medium">Use Client</span>
                  </button>
                ))}
              </div>
            )}

            {!clientLinked && possibleBookingMatches.length > 0 && (
              <div className="space-y-3" data-testid="guided-possible-client-matches">
                <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Possible Matches</p>
                {possibleBookingMatches.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleUseExistingClient(client)}
                    disabled={isPending}
                    className="border-border bg-background hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-xl font-semibold">{client.fullName}</span>
                      <span className="text-muted-foreground block text-base">
                        {client.email}
                        {client.phone ? ` · ${client.phone}` : ''}
                      </span>
                      <Badge variant="secondary" className="mt-2">
                        {getClientSearchMatchLabel(client)}
                      </Badge>
                    </span>
                    <span className="text-sm font-medium">Review Client</span>
                  </button>
                ))}
              </div>
            )}

            <ClientSearchDialog selectedClientId={selectedBooking.client?.id ?? ''} onSelect={handleUseExistingClient}>
              <Button type="button" variant="outline" className="w-full" size="lg">
                <Search className="mr-2 size-5" />
                Search Existing Clients
              </Button>
            </ClientSearchDialog>

            <Button type="button" onClick={handleRegisterClient} className="w-full" size="lg">
              <UserPlus data-icon="inline-start" />
              Register New Client
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderPayment = () => {
    if (isLoading) return renderLoading('Payment')
    if (selectedBooking?.needsRegistration || selectedBooking?.needsTestType) return renderRegistration()
    if (!selectedBooking || !selectedBooking.testType) return renderMissingBooking('Payment')
    const clientCreditBalance = selectedBooking.client?.creditBalance ?? 0
    const recordedPayment = selectedBooking.guidedPaymentSummary
    const hasRecordedPayment = Boolean(
      recordedPayment && (recordedPayment.newMoneyAmount > 0 || recordedPayment.creditAppliedAmount > 0),
    )
    const allocationPreview = buildGuidedPaymentAllocationPreview({
      previousBalances: outstandingPaymentBalances,
      currentBalanceDue: payment.currentBalanceDue,
      amountReceived,
      clientCreditAvailable: clientCreditBalance,
      clientCreditApplied: creditToApply,
    })
    const compactPreviousAllocations = compactPreviousPaymentAllocations(allocationPreview.previousAllocations)
    const quickAmounts = getGuidedPaymentQuickAmounts(
      allocationPreview.currentBalanceAfterCredit,
      allocationPreview.dueAfterCredit,
    )
    const activeQuickAmount = quickAmounts.includes(amountReceived) ? [String(amountReceived)] : []
    const maximumCredit = getGuidedCreditMaximum(clientCreditBalance, allocationPreview.totalDue)
    const futureCreditBalance = allocationPreview.clientCreditRemaining + allocationPreview.creditAmount

    if (hasRecordedPayment && recordedPayment && !showAdditionalPayment) {
      const totalRecorded = recordedPayment.newMoneyAmount + recordedPayment.creditAppliedAmount
      const remainingBookingBalance = Math.max(
        0,
        (selectedBooking.payment?.amountDue ?? selectedBooking.testType.price) -
          (selectedBooking.payment?.amountPaid ?? 0),
      )
      const moneyMethod = recordedPayment.method === 'card' ? 'Card' : 'Cash'

      return (
        <div className="space-y-6">
          {renderHeader('Review & Payment', 'Review and Payment')}
          {renderPaymentReview(selectedBooking)}

          <Card className="rounded-lg" data-testid="guided-recorded-payment">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <CheckCircle2 className="text-success size-6" />
                Payment recorded
              </CardTitle>
              <CardDescription className="text-base">
                This payment has been applied and remains in the audit history.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="border-border overflow-hidden rounded-lg border">
                <div className="bg-muted/20 flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="text-lg font-semibold">{selectedBooking.testType.label}</p>
                    {recordedPayment.collectedAt && (
                      <p className="text-muted-foreground text-sm">
                        Recorded {formatPaymentDate(recordedPayment.collectedAt)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-sm font-medium">Total recorded</p>
                    <p className="text-2xl font-semibold">{currency.format(totalRecorded)}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3 p-4">
                  {recordedPayment.creditAppliedAmount > 0 && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-2 font-medium">
                        <CreditCard className="text-success size-4" /> Client credit
                      </span>
                      <span className="text-success font-semibold">
                        {currency.format(recordedPayment.creditAppliedAmount)}
                      </span>
                    </div>
                  )}
                  {recordedPayment.newMoneyAmount > 0 && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{moneyMethod}</span>
                      <span className="font-semibold">{currency.format(recordedPayment.newMoneyAmount)}</span>
                    </div>
                  )}
                  {recordedPayment.appliedToPreviousBalancesAmount > 0 && (
                    <div className="text-muted-foreground flex items-center justify-between gap-4 text-sm">
                      <span>Applied to previous tests</span>
                      <span>{currency.format(recordedPayment.appliedToPreviousBalancesAmount)}</span>
                    </div>
                  )}
                  <div className="text-muted-foreground flex items-center justify-between gap-4 text-sm">
                    <span>Applied to today&apos;s test</span>
                    <span>{currency.format(recordedPayment.appliedToBookingAmount)}</span>
                  </div>
                  {recordedPayment.creditCreatedAmount > 0 && (
                    <div className="text-success flex items-center justify-between gap-4 text-sm font-medium">
                      <span>Added to client credit</span>
                      <span>{currency.format(recordedPayment.creditCreatedAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-border bg-muted/20 grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Credit remaining</p>
                  <p className="text-success text-2xl font-semibold">{currency.format(clientCreditBalance)}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-muted-foreground text-sm font-medium">Today&apos;s balance remaining</p>
                  <p className={cn('text-2xl font-semibold', remainingBookingBalance > 0 && 'text-destructive')}>
                    {currency.format(remainingBookingBalance)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {remainingBookingBalance > 0 && (
                  <Button type="button" className="flex-1" onClick={() => setShowAdditionalPayment(true)}>
                    Add another payment
                  </Button>
                )}
                <AlertDialog open={undoPaymentDialogOpen} onOpenChange={setUndoPaymentDialogOpen}>
                  <AlertDialogTrigger
                    render={
                      <Button type="button" variant="outline" className="flex-1">
                        <Undo2 data-icon="inline-start" />
                        Undo payment
                      </Button>
                    }
                  />
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogMedia className="bg-destructive/10 text-destructive">
                        <Trash2Icon />
                      </AlertDialogMedia>
                      <AlertDialogTitle>Undo payment?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {recordedPayment.newMoneyAmount > 0
                          ? recordedPayment.method === 'card'
                            ? 'Correct the record without refunding the card charge.'
                            : 'Remove this payment from the balance record.'
                          : 'Correct the record and restore the applied client credit.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        type="button"
                        variant="destructive"
                        onClick={handleUndoPayment}
                        disabled={isPending}
                      >
                        {isPending ? 'Undoing...' : 'Undo payment'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {renderHeader('Review & Payment', 'Review and Payment')}
        {renderPaymentReview(selectedBooking)}

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <CreditCard className="size-6" />
              Collect payment
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {hasOutstandingPaymentBalanceError ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Balances could not be loaded</AlertTitle>
                <AlertDescription>Refresh the page before recording this payment.</AlertDescription>
              </Alert>
            ) : (
              <div
                className={cn(
                  'border-border bg-muted/30 grid gap-4 rounded-lg border p-4',
                  clientCreditBalance > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
                )}
              >
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm font-medium">Previous balance</p>
                  {isLoadingOutstandingPaymentBalances ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-semibold">{currency.format(allocationPreview.previousBalanceTotal)}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm font-medium">Today&apos;s test</p>
                  <p className="text-2xl font-semibold">{currency.format(allocationPreview.currentBalanceDue)}</p>
                </div>
                {clientCreditBalance > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-sm font-medium">Credit available</p>
                    <p className="text-success text-2xl font-semibold">{currency.format(clientCreditBalance)}</p>
                  </div>
                )}
                <div className="flex flex-col gap-1 sm:border-l sm:pl-4">
                  <p className="text-muted-foreground text-sm font-medium">Total Due</p>
                  {isLoadingOutstandingPaymentBalances ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <p className="text-3xl font-bold">
                      {currency.format(
                        clientCreditBalance > 0 ? allocationPreview.dueAfterCredit : allocationPreview.totalDue,
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {clientCreditBalance > 0 && (
              <div className="border-success/50 bg-success/5 space-y-4 rounded-lg border p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="flex gap-3">
                    <div className="border-success/50 bg-success/10 flex size-9 shrink-0 items-center justify-center rounded-full border">
                      <CreditCard className="text-success size-4" />
                    </div>
                    <div>
                      <p className="font-semibold">Client credit</p>
                      <p className="text-success text-2xl font-semibold">
                        {currency.format(clientCreditBalance)} available
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={creditToApply > 0 ? 'outline' : 'default'}
                    aria-pressed={creditToApply > 0}
                    onClick={() => {
                      const nextCredit = creditToApply > 0 ? 0 : maximumCredit
                      const creditIncrease = Math.max(0, nextCredit - creditToApply)
                      setPaymentDraft((current) => ({
                        ...(current ?? payment),
                        creditToApply: String(nextCredit),
                        amountReceived: String(Math.max(0, amountReceived - creditIncrease)),
                      }))
                    }}
                  >
                    {creditToApply > 0 ? 'Remove credit' : `Apply ${currency.format(maximumCredit)} credit`}
                  </Button>
                </div>

                <Field data-invalid={!creditAmountIsValid || undefined}>
                  <FieldLabel htmlFor="credit-to-apply">Credit to apply</FieldLabel>
                  <InputGroup className="h-11!">
                    <InputGroupInput
                      id="credit-to-apply"
                      name="creditToApply"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={maximumCredit}
                      step={1}
                      value={payment.creditToApply}
                      aria-invalid={!creditAmountIsValid || undefined}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({
                          ...(current ?? payment),
                          creditToApply: event.target.value,
                        }))
                      }
                    />
                    <InputGroupAddon>
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError
                    errors={
                      creditAmountIsValid ? [] : ['Credit cannot exceed the available credit or total balance due.']
                    }
                  />
                </Field>
              </div>
            )}

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!paymentAmountIsValid || undefined}>
                <FieldLabel htmlFor="amount-received">Amount received now</FieldLabel>
                <InputGroup className="h-12!">
                  <InputGroupInput
                    id="amount-received"
                    name="amountReceived"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={payment.amountReceived}
                    aria-invalid={!paymentAmountIsValid || undefined}
                    onChange={(event) =>
                      setPaymentDraft((current) => ({
                        ...(current ?? payment),
                        amountReceived: event.target.value,
                      }))
                    }
                    className="text-lg"
                  />
                  <InputGroupAddon>
                    <InputGroupText>$</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError errors={paymentAmountIsValid ? [] : ['Enter zero or a positive amount received.']} />
              </Field>

              <Field>
                <FieldLabel htmlFor="payment-method">Method</FieldLabel>
                <Select
                  items={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'card', label: 'Card' },
                  ]}
                  value={payment.method}
                  onValueChange={(method) =>
                    setPaymentDraft((current) => ({
                      ...(current ?? payment),
                      method: (method ?? 'cash') as GuidedPaymentEntryMethod,
                    }))
                  }
                >
                  <SelectTrigger id="payment-method" className="h-12! w-full text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            {!isLoadingOutstandingPaymentBalances && !hasOutstandingPaymentBalanceError && (
              <ToggleGroup
                value={activeQuickAmount}
                onValueChange={(values) => {
                  const value = values.at(-1)
                  if (value === undefined) return
                  setPaymentDraft((current) => ({
                    ...(current ?? payment),
                    amountReceived: value,
                  }))
                }}
                variant="outline"
                className="w-full"
                aria-label="Quick amount received"
              >
                {quickAmounts.map((amount) => (
                  <ToggleGroupItem
                    key={amount}
                    value={String(amount)}
                    aria-label={`Set amount received to ${currency.format(amount)}`}
                    className="h-10"
                  >
                    {currency.format(amount)}
                    {amount > 0 && amount === allocationPreview.dueAfterCredit ? ' · Pay all' : ''}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}

            <div className="border-border overflow-hidden rounded-lg border">
              <div className="p-4">
                <p className="text-lg font-semibold">Payment allocation</p>
              </div>
              <Separator />

              {isLoadingOutstandingPaymentBalances ? (
                <div className="flex flex-col gap-4 p-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : hasOutstandingPaymentBalanceError ? (
                <p className="text-destructive p-4 text-sm">Allocation preview is unavailable.</p>
              ) : (
                <div className="divide-border divide-y">
                  {compactPreviousAllocations.map((row) => {
                    if (row.kind === 'summary') {
                      return (
                        <div
                          key={row.key}
                          className="bg-muted/20 grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div className="flex flex-col gap-1">
                            <p className="font-medium">{row.count} other previous tests</p>
                            <p className="text-muted-foreground text-sm">{currency.format(row.amountDue)} total due</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-medium">{currency.format(row.amountApplied)} applied</p>
                            {row.creditApplied > 0 && (
                              <p className="text-success text-sm font-medium">
                                {currency.format(row.creditApplied)} credit
                                {row.newMoneyApplied > 0 ? ` + ${currency.format(row.newMoneyApplied)} new money` : ''}
                              </p>
                            )}
                            {row.balanceRemaining > 0 && (
                              <p className="text-destructive text-sm">
                                {currency.format(row.balanceRemaining)} remaining
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    }

                    const allocationNumber =
                      allocationPreview.previousAllocations.findIndex(
                        (allocation) => allocation.id === row.allocation.id,
                      ) + 1

                    return (
                      <div
                        key={row.allocation.id}
                        className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                      >
                        <Badge variant="outline" className="size-8 rounded-full p-0">
                          {allocationNumber}
                        </Badge>
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="font-medium">
                            {formatPaymentDate(row.allocation.collectionDate)} · {row.allocation.testTypeLabel}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            Previous test · {currency.format(row.allocation.balanceDue)} due
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium">{currency.format(row.allocation.amountApplied)} applied</p>
                          {row.allocation.creditApplied > 0 && (
                            <p className="text-success text-sm font-medium">
                              {currency.format(row.allocation.creditApplied)} credit
                              {row.allocation.newMoneyApplied > 0
                                ? ` + ${currency.format(row.allocation.newMoneyApplied)} new money`
                                : ''}
                            </p>
                          )}
                          {row.allocation.balanceRemaining <= 0 ? (
                            <Badge variant="success">Paid</Badge>
                          ) : (
                            <p className="text-destructive text-sm font-medium">
                              {currency.format(row.allocation.balanceRemaining)} remaining
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <div className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <Badge variant="outline" className="size-8 rounded-full p-0">
                      {allocationPreview.previousAllocations.length + 1}
                    </Badge>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-medium">Today · {selectedBooking.testType.label}</p>
                      <p className="text-muted-foreground text-sm">
                        Current test · {currency.format(allocationPreview.currentBalanceDue)} due
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-medium">{currency.format(allocationPreview.currentAmountApplied)} applied</p>
                      {allocationPreview.currentCreditApplied > 0 && (
                        <p className="text-success text-sm font-medium">
                          {currency.format(allocationPreview.currentCreditApplied)} credit
                          {allocationPreview.currentNewMoneyApplied > 0
                            ? ` + ${currency.format(allocationPreview.currentNewMoneyApplied)} new money`
                            : ''}
                        </p>
                      )}
                      {allocationPreview.currentBalanceRemaining <= 0 ? (
                        <Badge variant="success">Paid</Badge>
                      ) : (
                        <p className="text-destructive text-sm font-medium">
                          {currency.format(allocationPreview.currentBalanceRemaining)} remaining
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!isLoadingOutstandingPaymentBalances && !hasOutstandingPaymentBalanceError && (
              <div className="border-border bg-muted/20 grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Balance still due</p>
                  <p
                    className={cn(
                      'text-2xl font-semibold',
                      allocationPreview.remainingClientBalance > 0 && 'text-destructive',
                    )}
                  >
                    {currency.format(allocationPreview.remainingClientBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Credit remaining</p>
                  <p className="text-success text-2xl font-semibold">{currency.format(futureCreditBalance)}</p>
                  {allocationPreview.creditAmount > 0 && (
                    <p className="text-muted-foreground text-sm">
                      Includes {currency.format(allocationPreview.creditAmount)} new credit
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-muted-foreground text-sm font-medium">New money collected</p>
                  <p className="text-2xl font-semibold">{currency.format(amountReceived)}</p>
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
          ['DOB', formatDobInput(client?.dob) || 'Unknown'],
          ['Sex', formatGuidedGender(client?.gender)],
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
      ? Boolean(
          selectedBooking?.testType &&
          selectedBooking.client?.id &&
          paymentAmountIsValid &&
          creditAmountIsValid &&
          !isLoadingOutstandingPaymentBalances &&
          !hasOutstandingPaymentBalanceError &&
          clientIdentityIsVerified,
        )
      : currentStep === 'toxaccess'
        ? Boolean(
            paymentRecorded && selectedBooking?.testType && selectedBooking.client?.id && clientIdentityIsVerified,
          )
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
              onClick={currentStep === 'payment' ? () => handlePaymentNext() : handleContinueToCollection}
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

      <AlertDialog open={noPaymentDialogOpen} onOpenChange={setNoPaymentDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Continue without payment?</AlertDialogTitle>
            <AlertDialogDescription>
              No payment has been collected. The client will continue to collection with an outstanding balance of{' '}
              {currency.format(paymentTotalDue)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Go back</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => handlePaymentNext(true)} disabled={isPending}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReferralProfileDrawer
        open={referralDrawerOpen}
        onOpenChange={setReferralDrawerOpen}
        clientId={selectedClientId}
        previewData={referralPreviewData}
        fallbackReferralEmails={referralProfile?.referralEmails ?? []}
        onSaved={() => {
          setPaymentDraft(null)
          void refreshBookings()
          void refetchReferralProfile()
        }}
      />

      <Drawer swipeDirection="right" open={testTypeDrawerOpen} onOpenChange={setTestTypeDrawerOpen}>
        <DrawerContent className="bg-background shadow-2xl data-[swipe-direction=right]:w-[min(36rem,calc(100vw-1rem))] data-[swipe-direction=right]:border-l-2 data-[swipe-direction=right]:sm:max-w-none">
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

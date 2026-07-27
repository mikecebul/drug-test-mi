'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Ellipsis,
  Pencil,
  Loader2,
  ClipboardList,
  Search,
  Trash2Icon,
  TriangleAlert,
  Undo2,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { focusFirstInvalidField } from '@/lib/form-scroll-focus'
import { cn } from '@/utilities/cn'
import { RegisterClientDialog } from '../../components/RegisterClientDialog'
import type { ClientMatch } from '../../types'
import { ClientDetailsCard } from '../components/client/ClientDetailsCard'
import type { SimpleClient } from '../components/client/getClients'
import {
  cancelAndRefundGuidedBooking,
  cancelGuidedBooking,
  createWalkInBooking,
  ensureClientRedwoodProvisioning,
  getActiveCollectionTestTypes,
  getClientOutstandingPaymentBalances,
  getClientReferralProfile,
  getClientRedwoodProvisioningStatus,
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
import { RedwoodProvisioningCard } from './RedwoodProvisioningCard'
import { WalkInClientDrawer } from './WalkInClientDrawer'

type Booking = Awaited<ReturnType<typeof getTodaysCollectionBookings>>[number]
type TestType = NonNullable<Booking['testType']>
type WorkflowStep = 'schedule' | 'review' | 'registration' | 'payment' | 'toxaccess'
type ScheduleAction = 'cancel' | 'cancel-refund'

const workflowSteps = ['schedule', 'review', 'registration', 'payment', 'toxaccess'] as const

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
  const redwoodProvisioningStartedForBooking = useRef<string | null>(null)
  const [walkInClientDrawerOpen, setWalkInClientDrawerOpen] = useState(false)
  const [bookingClientDrawerOpen, setBookingClientDrawerOpen] = useState(false)
  const [walkInRegistrationOpen, setWalkInRegistrationOpen] = useState(false)
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === query.bookingId) ?? null,
    [bookings, query.bookingId],
  )
  const selectedClientId = selectedBooking?.client?.id ?? null
  const selectedTestTypeValue = selectedBooking?.testType?.value ?? null
  const redwoodProvisioningBookingKey =
    selectedBooking && selectedClientId && selectedTestTypeValue
      ? `${selectedBooking.id}:${selectedClientId}:${selectedTestTypeValue}`
      : null
  const currentStep: WorkflowStep = query.step
  const { data: referralProfile = null, refetch: refetchReferralProfile } = useQuery({
    queryKey: ['guided', 'referral-profile', selectedClientId],
    queryFn: () => getClientReferralProfile(selectedClientId || ''),
    enabled: Boolean(selectedClientId),
  })
  const {
    data: redwoodProvisioning,
    isLoading: isRedwoodProvisioningLoading,
    refetch: refetchRedwoodProvisioning,
  } = useQuery({
    queryKey: ['guided', 'redwood-provisioning', selectedClientId, selectedTestTypeValue],
    queryFn: () => getClientRedwoodProvisioningStatus(selectedClientId || '', selectedTestTypeValue || ''),
    enabled: currentStep === 'toxaccess' && Boolean(selectedClientId && selectedTestTypeValue),
    refetchInterval: (query) => {
      const status = query.state.data
      if (!status || status.overallStatus === 'working') return 1500
      return false
    },
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
  const [verifiedClientMismatchKeys, setVerifiedClientMismatchKeys] = useState<Set<string>>(() => new Set())
  const [clientIdentityValidationErrorKey, setClientIdentityValidationErrorKey] = useState<string | null>(null)
  const [testTypeValidationErrorBookingId, setTestTypeValidationErrorBookingId] = useState<string | null>(null)
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
  const clientIdentityIsVerified =
    !selectedClientMismatchKey || verifiedClientMismatchKeys.has(selectedClientMismatchKey)
  const guidedWorkflowRef = useRef<HTMLDivElement>(null)

  const focusGuidedInvalidField = () => {
    requestAnimationFrame(() => {
      focusFirstInvalidField(guidedWorkflowRef.current)
    })
  }

  const validateClientIdentity = () => {
    if (clientIdentityIsVerified) return true

    setClientIdentityValidationErrorKey(selectedClientMismatchKey)
    focusGuidedInvalidField()
    return false
  }
  const refreshBookings = () =>
    queryClient.fetchQuery({
      queryKey: ['guided', 'today-bookings'],
      queryFn: () => getTodaysCollectionBookings(),
    })
  useEffect(() => {
    if (currentStep !== 'toxaccess' || !selectedClientId || !selectedTestTypeValue) return
    if (!redwoodProvisioningBookingKey) return
    if (redwoodProvisioningStartedForBooking.current === redwoodProvisioningBookingKey) return

    redwoodProvisioningStartedForBooking.current = redwoodProvisioningBookingKey
    void ensureClientRedwoodProvisioning(selectedClientId, selectedTestTypeValue).then((result) => {
      if (!result.success && result.error) {
        toast.error(result.error)
      }
      void refetchRedwoodProvisioning()
    })
  }, [currentStep, redwoodProvisioningBookingKey, refetchRedwoodProvisioning, selectedClientId, selectedTestTypeValue])

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
        setQuery({ step: 'review', bookingId: selectedBooking.id })
        return
      }

      toast.success(`${client.fullName ?? `${client.firstName} ${client.lastName}`} linked to booking`)
      setQuery({ step: 'review', bookingId: selectedBooking.id })
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

      setTestTypeValidationErrorBookingId(null)
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

  const handleCreateWalkInBooking = async (clientId: string, clientName: string) => {
    const result = await createWalkInBooking({ clientId })

    if (!result.success || !result.bookingId) {
      toast.error(result.error || 'Failed to add the walk-in client.')
      return false
    }

    await refreshBookings()
    toast.success(`${clientName} added to today's schedule`)
    return true
  }

  const handleWalkInClientCreated = (client: ClientMatch) => {
    const fullName = [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ')

    void handleCreateWalkInBooking(client.id, fullName)
  }

  const handleOpenWalkInRegistration = () => {
    setWalkInClientDrawerOpen(false)
    setWalkInRegistrationOpen(true)
  }

  const handlePaymentNext = (confirmedNoPayment = false) => {
    if (!selectedBooking?.testType) return
    const selectedTestType = selectedBooking.testType
    if (!selectedBooking.client?.id) {
      toast.error('Select or register the client before recording payment.')
      return
    }
    if (!validateClientIdentity()) return
    if (!paymentAmountIsValid) {
      focusGuidedInvalidField()
      return
    }
    if (!creditAmountIsValid) {
      focusGuidedInvalidField()
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

      if (selectedBooking.client?.id) {
        const provisioningResult = await ensureClientRedwoodProvisioning(
          selectedBooking.client.id,
          selectedTestType.value,
        )
        redwoodProvisioningStartedForBooking.current = `${selectedBooking.id}:${selectedBooking.client.id}:${selectedTestType.value}`
        if (!provisioningResult.success && provisioningResult.error) {
          toast.warning(provisioningResult.error)
        }
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

  const handleReviewNext = () => {
    if (!selectedBooking?.client?.id) {
      setBookingClientDrawerOpen(true)
      return
    }
    if (!selectedBooking.testType) {
      setTestTypeValidationErrorBookingId(selectedBooking.id)
      focusGuidedInvalidField()
      return
    }
    if (!validateClientIdentity()) return

    setPaymentDraft(getPaymentDefaults(selectedBooking))
    setQuery({ step: 'payment', bookingId: selectedBooking.id })
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
    if (!validateClientIdentity()) return

    startTransition(async () => {
      if (!redwoodProvisioning?.canContinue) {
        toast.warning('ToxAccess setup is not verified. Complete the collection manually if needed.')
      }

      const context = await refreshBookingClientContext(selectedBooking.id)

      if (context.needsRegistration || !context.clientId) {
        toast.error('Select or register the client before collection.')
        await refreshBookings()
        setQuery({ step: 'review', bookingId: selectedBooking.id })
        return
      }

      if (context.needsTestType || !context.testType) {
        toast.error('Select the test type for this appointment before collection.')
        await refreshBookings()
        setQuery({ step: 'review', bookingId: selectedBooking.id })
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

    if (currentStep === 'payment') {
      setQuery({ step: 'review' })
      return
    }

    setQuery({ step: 'schedule' })
  }

  const renderHeader = (eyebrow: string, title = 'Complete Scheduled Collection') => (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{eyebrow}</p>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
    </div>
  )

  const renderClientIdentityMismatch = (booking: Booking) => {
    const mismatchKey = getClientIdentityMismatchKey(booking)
    if (!mismatchKey || !booking.client) return null
    if (verifiedClientMismatchKeys.has(mismatchKey)) return null

    const selectedClientName = getGuidedClientName(booking.client) || 'Unknown client'
    const confirmationId = `verify-client-identity-${booking.id}`
    const confirmationErrorId = `${confirmationId}-error`
    const showValidationError = clientIdentityValidationErrorKey === mismatchKey

    return (
      <Alert variant="warning" data-testid="client-identity-mismatch">
        <TriangleAlert />
        <AlertTitle>Booking name does not match the selected client</AlertTitle>
        <AlertDescription>
          <p>
            Booked as <strong>{booking.attendeeName}</strong>, but the selected client is{' '}
            <strong>{selectedClientName}</strong>.
          </p>
          <p>Change the client if this is wrong. Otherwise, verify their identity before continuing.</p>
          <Field orientation="horizontal" className="mt-3" data-invalid={showValidationError || undefined}>
            <Checkbox
              id={confirmationId}
              aria-required="true"
              aria-invalid={showValidationError || undefined}
              aria-describedby={showValidationError ? confirmationErrorId : undefined}
              onCheckedChange={(checked) => {
                if (checked !== true) return

                setVerifiedClientMismatchKeys((current) => {
                  const next = new Set(current)
                  next.add(mismatchKey)
                  return next
                })
                setClientIdentityValidationErrorKey((current) => (current === mismatchKey ? null : current))
              }}
            />
            <FieldContent>
              <FieldLabel htmlFor={confirmationId} className="cursor-pointer font-normal">
                I verified {selectedClientName} is the person testing today.
              </FieldLabel>
              <FieldError
                id={confirmationErrorId}
                errors={showValidationError ? ['Verify the selected client before continuing.'] : []}
              />
            </FieldContent>
          </Field>
        </AlertDescription>
      </Alert>
    )
  }

  const renderBookingDetails = (booking: Booking, editable = false) => {
    const amountDisplay = getAmountDisplay(booking)
    const prepaidTestLabel = booking.bookingTestType?.label ?? 'Unknown'
    const referralTestLabel = booking.referralTestType?.label ?? 'Not set'
    const todayTestLabel = booking.testType?.label ?? 'Not set'
    const referralLabel = booking.referral
      ? booking.referral.type === 'self' || booking.referral.name.toLowerCase() === booking.referral.type?.toLowerCase()
        ? booking.referral.name
        : `${booking.referral.name}${booking.referral.type ? ` (${booking.referral.type})` : ''}`
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
      {
        label: 'Referral',
        value: referralLabel,
        subValue: `Default test: ${referralTestLabel}`,
        action: editable && booking.client ? () => setReferralDrawerOpen(true) : undefined,
      },
      {
        label: 'Booking test',
        value: prepaidTestLabel,
        action: editable ? openTestTypeDrawer : undefined,
      },
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
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="size-5" />
            Booking Information
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 pt-0">
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
            {reviewRows.map((item) => {
              const showTestTypeError =
                item.label === 'Booking test' &&
                testTypeValidationErrorBookingId === booking.id &&
                !booking.testType
              const errorId = `booking-test-error-${booking.id}`

              return (
                <div
                  key={item.label}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{item.label}</p>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.value}</p>
                      {'subValue' in item && item.subValue && (
                        <p className="text-muted-foreground text-sm">{item.subValue}</p>
                      )}
                      {showTestTypeError && (
                        <p id={errorId} className="text-destructive mt-1 text-sm">
                          Choose a test type before continuing.
                        </p>
                      )}
                    </div>
                    {item.badge && <Badge variant={item.badgeVariant}>{item.badge}</Badge>}
                  </div>
                  {'action' in item && item.action && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={item.action}
                      aria-label={`Edit ${item.label}`}
                      aria-invalid={showTestTypeError || undefined}
                      aria-describedby={showTestTypeError ? errorId : undefined}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderReview = () => {
    if (isLoading) return renderLoading('Review')
    if (!selectedBooking) return renderMissingBooking('Review')

    const client = selectedBooking.client

    return (
      <div className="flex flex-col gap-4">
        {renderHeader('Review', 'Review Client & Appointment')}

        {client ? (
          <div className="space-y-3">
            <ClientDetailsCard
              client={{
                ...client,
                referralTitle: selectedBooking.referral?.name || null,
              }}
              editable
              onChangeClient={() => setBookingClientDrawerOpen(true)}
              onClientUpdated={() => {
                setPaymentDraft(null)
                void refreshBookings()
                void refetchReferralProfile()
              }}
            />
          </div>
        ) : (
          <Card className="rounded-lg border-amber-300">
            <CardContent className="flex flex-col gap-3 p-4">
              <div>
                <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">Booking attendee</p>
                <p className="text-lg font-semibold">{selectedBooking.attendeeName}</p>
                <p className="text-muted-foreground">{selectedBooking.attendeeEmail}</p>
              </div>
              <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>No client profile is linked</AlertTitle>
                <AlertDescription>Choose an existing client or register a new client before payment.</AlertDescription>
              </Alert>
              <Button type="button" onClick={() => setBookingClientDrawerOpen(true)}>
                <UserPlus className="size-4" />
                Choose or Register Client
              </Button>
            </CardContent>
          </Card>
        )}

        {renderClientIdentityMismatch(selectedBooking)}
        {renderBookingDetails(selectedBooking, true)}
      </div>
    )
  }

  const renderSchedule = () => {
    const actionCopy = scheduleAction ? getScheduleActionCopy(scheduleAction.action, scheduleAction.booking) : null

    return (
      <div className="flex flex-col gap-4">
        {renderHeader('Today')}
        <p className="text-muted-foreground max-w-2xl">
          Select the scheduled client who is ready for collection. Review the appointment, then collect payment.
        </p>

        <Card className="rounded-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" />
              Today&apos;s Schedule
            </CardTitle>
            <CardDescription>Name, time, gender, payment status, and registration status.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-4 pt-0">
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading appointments...</p>
            ) : bookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No Cal.com appointments scheduled for today.</p>
            ) : (
              bookings.map((booking) => {
                const paymentLabel = getPaymentLabel(booking)
                const needsRegistration = booking.needsRegistration
                const canRefund = canRefundPrepaidBooking(booking)
                const isCompleted = booking.sampleCollection?.status === 'collected'
                return (
                  <div
                    key={booking.id}
                    className={cn(
                      'border-border bg-card grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border p-3 transition',
                      isCompleted ? 'border-border/60 bg-muted/40 text-muted-foreground' : 'hover:bg-muted/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectBooking(booking)}
                      disabled={isCompleted}
                      className="hover:text-foreground focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-md text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
                    >
                      <Avatar className={cn('size-10 shrink-0', isCompleted && 'opacity-60 grayscale')}>
                        <AvatarImage src={booking.client?.headshot || undefined} alt={booking.attendeeName} />
                        <AvatarFallback>
                          {booking.attendeeName
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part.charAt(0))
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 space-y-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'block font-semibold',
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
                        <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
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

        <Card data-testid="guided-walk-in-card" className="overflow-hidden border-l-4 border-l-primary">
          <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-center">
            <div className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
              <UserPlus className="size-4" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <CardTitle className="text-lg">Walk-In Collection</CardTitle>
              <CardDescription>Add a client without an appointment to today&apos;s schedule.</CardDescription>
            </div>
            <Button
              id="walk-in-client-trigger"
              type="button"
              className="w-full sm:w-auto"
              onClick={() => setWalkInClientDrawerOpen(true)}
            >
              <Search data-icon="inline-start" />
              Choose client
              <ChevronRight data-icon="inline-end" />
            </Button>
          </CardHeader>
        </Card>
        <WalkInClientDrawer
          open={walkInClientDrawerOpen}
          onOpenChange={setWalkInClientDrawerOpen}
          onRegister={handleOpenWalkInRegistration}
          onSelect={(client: SimpleClient) =>
            handleCreateWalkInBooking(
              client.id,
              client.fullName || `${client.firstName} ${client.lastName}`,
            )
          }
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
    <div className="flex flex-col gap-4">
      {renderHeader(eyebrow)}
      <Card className="rounded-lg">
        <CardContent className="text-muted-foreground p-4">Loading booking...</CardContent>
      </Card>
    </div>
  )

  const renderMissingBooking = (eyebrow: string) => (
    <div className="flex flex-col gap-4">
      {renderHeader(eyebrow)}
      <Card className="rounded-lg">
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-muted-foreground">
            This booking is no longer available. Return to today&apos;s schedule and select the client again.
          </p>
          <Button type="button" onClick={() => setQuery({ step: 'schedule', bookingId: null })} size="lg">
            Back to Today&apos;s Schedule
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderPayment = () => {
    if (isLoading) return renderLoading('Payment')
    if (selectedBooking?.needsRegistration || selectedBooking?.needsTestType) return renderReview()
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
        <div className="flex flex-col gap-4">
          {renderHeader('Payment', 'Collect Payment')}

          <Card className="rounded-lg" data-testid="guided-recorded-payment">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="text-success size-5" />
                Payment recorded
              </CardTitle>
              <CardDescription>This payment has been applied and remains in the audit history.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 pt-0">
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
                    <p className="text-xl font-semibold">{currency.format(totalRecorded)}</p>
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
                  <p className="text-success text-xl font-semibold">{currency.format(clientCreditBalance)}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-muted-foreground text-sm font-medium">Today&apos;s balance remaining</p>
                  <p className={cn('text-xl font-semibold', remainingBookingBalance > 0 && 'text-destructive')}>
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
      <div className="flex flex-col gap-4">
        {renderHeader('Payment', 'Collect Payment')}

        <Card className="border-primary/20 overflow-hidden rounded-lg">
          <CardHeader className="border-border bg-muted/20 border-b p-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full">
                <CreditCard className="size-4" />
              </span>
              Collect payment
            </CardTitle>
            <CardDescription>
              Review the balance, enter the amount received, then use the primary button below to record it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 p-4">
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
                    <p className="text-xl font-semibold">{currency.format(allocationPreview.previousBalanceTotal)}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm font-medium">Today&apos;s test</p>
                  <p className="text-xl font-semibold">{currency.format(allocationPreview.currentBalanceDue)}</p>
                </div>
                {clientCreditBalance > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-sm font-medium">Credit available</p>
                    <p className="text-success text-xl font-semibold">{currency.format(clientCreditBalance)}</p>
                  </div>
                )}
                <div className="border-primary/30 bg-background flex flex-col gap-1 rounded-lg border p-3 sm:col-span-1">
                  <p className="text-primary text-sm font-semibold tracking-wide uppercase">Total Due</p>
                  {isLoadingOutstandingPaymentBalances ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <p className="text-2xl font-bold">
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
                      <p className="text-success text-xl font-semibold">
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

            <section className="border-primary/40 bg-primary/5 flex flex-col gap-4 rounded-xl border p-4">
              <div>
                <p className="text-lg font-semibold">Enter payment received</p>
                <p className="text-muted-foreground text-sm">
                  Choose a quick amount or type the exact amount the client is paying now.
                </p>
              </div>

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
                  className="bg-muted/30 h-11 w-full"
                  aria-label="Quick amount received"
                >
                  {quickAmounts.map((amount) => (
                    <ToggleGroupItem
                      key={amount}
                      value={String(amount)}
                      aria-label={`Set amount received to ${currency.format(amount)}`}
                      className="text-muted-foreground h-11 opacity-60 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:opacity-100"
                    >
                      {currency.format(amount)}
                      {amount > 0 && amount === allocationPreview.dueAfterCredit ? ' · Pay all' : ''}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}

              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!paymentAmountIsValid || undefined}>
                  <FieldLabel htmlFor="amount-received" className="font-semibold">
                    Amount received now
                  </FieldLabel>
                  <InputGroup
                    className="border-primary/50 bg-background h-12! shadow-sm"
                    data-testid="amount-received-control"
                  >
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
                      className="text-xl font-bold"
                    />
                    <InputGroupAddon>
                      <InputGroupText className="font-semibold">$</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError errors={paymentAmountIsValid ? [] : ['Enter zero or a positive amount received.']} />
                </Field>

                <Field>
                  <FieldLabel id="payment-method-label" className="font-semibold">
                    Payment method
                  </FieldLabel>
                  <ToggleGroup
                    aria-labelledby="payment-method-label"
                    variant="outline"
                    value={[payment.method]}
                    onValueChange={(methods) => {
                      const method = methods[0] as GuidedPaymentEntryMethod | undefined
                      if (!method) return
                      setPaymentDraft((current) => ({
                        ...(current ?? payment),
                        method,
                      }))
                    }}
                    className="bg-muted/30 h-12 w-full"
                    data-testid="payment-method-control"
                  >
                    <ToggleGroupItem
                      value="cash"
                      aria-label="Cash payment method"
                      className="text-muted-foreground h-12 px-3 opacity-60 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:opacity-100"
                    >
                      <Banknote />
                      Cash
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="card"
                      aria-label="Card payment method"
                      className="text-muted-foreground h-12 px-3 opacity-60 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:opacity-100"
                    >
                      <CreditCard />
                      Card
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </FieldGroup>
            </section>

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
                      'text-xl font-semibold',
                      allocationPreview.remainingClientBalance > 0 && 'text-destructive',
                    )}
                  >
                    {currency.format(allocationPreview.remainingClientBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Credit remaining</p>
                  <p className="text-success text-xl font-semibold">{currency.format(futureCreditBalance)}</p>
                  {allocationPreview.creditAmount > 0 && (
                    <p className="text-muted-foreground text-sm">
                      Includes {currency.format(allocationPreview.creditAmount)} new credit
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-muted-foreground text-sm font-medium">New money collected</p>
                  <p className="text-xl font-semibold">{currency.format(amountReceived)}</p>
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
    if (selectedBooking?.needsRegistration || selectedBooking?.needsTestType) return renderReview()
    if (!selectedBooking) return renderMissingBooking('ToxAccess')
    const client = selectedBooking.client
    const isFirstTest = !client?.firstDrugTestDate
    const fullName = getToxAccessName(selectedBooking, isFirstTest)
    const toxAccessRows: Array<{ label: string; value: string }> = [
      { label: 'Name', value: fullName },
      {
        label: selectedBooking.testType?.category === 'lab' ? 'Test Code' : 'Test',
        value: getToxAccessTestValue(selectedBooking.testType),
      },
    ]

    return (
      <div className="flex flex-col gap-4">
        {renderHeader('ToxAccess', 'Collect Sample in ToxAccess')}
        {selectedBooking.client && (
          <ClientDetailsCard
            client={{
              ...selectedBooking.client,
              referralTitle: selectedBooking.referral?.name || null,
            }}
            editable
            onClientUpdated={() => {
              void refreshBookings()
              void refetchReferralProfile()
            }}
          />
        )}
        <RedwoodProvisioningCard status={redwoodProvisioning} isLoading={isRedwoodProvisioningLoading} />

        {!isFirstTest && (
          <Card className="rounded-lg">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="size-5" />
                ToxAccess Reference
              </CardTitle>
              <CardDescription>Use these values to find the client and select the test.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 pt-0">
              {toxAccessRows.map(({ label, value }) => (
                <div
                  key={label}
                  className="border-border bg-background grid gap-1 rounded-lg border p-3 sm:grid-cols-[120px_1fr] sm:items-center"
                >
                  <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{label}</p>
                  <p className="font-semibold">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const renderCurrentStep = () => {
    if (currentStep === 'review' || currentStep === 'registration') return renderReview()
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

  const nextLabel =
    currentStep === 'review' || currentStep === 'registration'
      ? 'Continue to Payment'
      : currentStep === 'payment'
        ? amountReceived > 0 || creditToApply > 0
          ? 'Record Payment & Continue'
          : 'Continue to Collection Setup'
        : 'Continue Collection'
  const canGoNext =
    currentStep === 'review' || currentStep === 'registration'
      ? Boolean(selectedBooking)
      : currentStep === 'payment'
        ? Boolean(
            selectedBooking?.testType &&
            selectedBooking.client?.id &&
            !isLoadingOutstandingPaymentBalances &&
            !hasOutstandingPaymentBalanceError,
          )
        : currentStep === 'toxaccess'
          ? Boolean(paymentRecorded && selectedBooking?.testType && selectedBooking.client?.id)
          : false

  const backLabel = currentStep === 'schedule' ? 'Cancel' : 'Back'

  return (
    <>
      <div ref={guidedWorkflowRef} className="mx-auto flex w-full max-w-4xl flex-col px-2 pb-8 sm:px-4">
        {renderCurrentStep()}

        <div className="mt-6 flex items-center justify-between border-t pt-4">
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
              onClick={
                currentStep === 'review' || currentStep === 'registration'
                  ? handleReviewNext
                  : currentStep === 'payment'
                    ? () => handlePaymentNext()
                    : handleContinueToCollection
              }
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

      <WalkInClientDrawer
        open={bookingClientDrawerOpen}
        onOpenChange={setBookingClientDrawerOpen}
        onRegister={() => {
          setBookingClientDrawerOpen(false)
          handleRegisterClient()
        }}
        onSelect={handleUseExistingClient}
      />

      <Drawer swipeDirection="right" open={testTypeDrawerOpen} onOpenChange={setTestTypeDrawerOpen}>
        <DrawerContent className="bg-background shadow-2xl data-[swipe-direction=right]:w-[min(640px,calc(100vw-16px))] data-[swipe-direction=right]:border-l-2 data-[swipe-direction=right]:sm:max-w-none">
          <DrawerHeader className="border-border border-b">
            <DrawerTitle>Change Today&apos;s Test</DrawerTitle>
            <DrawerDescription>
              Updates only this appointment so pricing and collection stay aligned for today.
            </DrawerDescription>
          </DrawerHeader>

          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
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

          <DrawerFooter className="border-border border-t sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setTestTypeDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!testTypeDrawerSelection || isPending}
              onClick={() =>
                handleSelectTestType(testTypeDrawerSelection, {
                  closeDrawer: true,
                  nextStep: currentStep === 'payment' ? 'payment' : 'review',
                })
              }
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

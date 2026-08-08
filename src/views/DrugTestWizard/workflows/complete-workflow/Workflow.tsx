'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Banknote,
  Camera,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Ellipsis,
  Mail,
  Pencil,
  Loader2,
  ClipboardList,
  Search,
  Trash2Icon,
  TriangleAlert,
  Undo2,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { focusFirstInvalidField, useStepFocus } from '@/lib/form-scroll-focus'
import { cn } from '@/utilities/cn'
import { RegisterClientDialog } from '../../components/RegisterClientDialog'
import type { ClientMatch } from '../../types'
import { ClientDetailsCard } from '../components/client/ClientDetailsCard'
import type { SimpleClient } from '../components/client/getClients'
import {
  guidedWorkflowApi,
  type GuidedBooking,
  type GuidedPaymentResult,
  type GuidedTerminalPaymentCancelResult,
  type GuidedTerminalPaymentResult,
  type GuidedUndoPaymentResult,
} from './guided-workflow-api'
import {
  doesGuidedBookingNameMatchClient,
  getGuidedBookingNextStep,
  getGuidedClientName,
  getGuidedPaymentLabel,
} from './schedule-utils'
import { ScheduleInfoBadges } from './components/ScheduleInfoBadges'
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

type Booking = GuidedBooking
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
const preciseCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

function createOperationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeRefundInput(value: number) {
  return Math.max(0, value).toFixed(2)
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
    sendReceipt: Boolean(booking?.client?.email && !booking.client.disableClientEmails),
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
        description: `${booking.attendeeName}'s collection stays completed. The successful refund will reduce the recorded test price by the same amount.`,
        confirmLabel: 'Refund payment',
      }
    }

    return {
      title: 'Cancel and refund appointment',
      description: `${booking.attendeeName}'s appointment will be cancelled after Stripe confirms the refund.`,
      confirmLabel: 'Refund and cancel',
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
    terminalPaymentId: parseAsString,
  })
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['guided', 'today-bookings'],
    queryFn: ({ signal }) => guidedWorkflowApi.getTodayBookings(signal),
    refetchOnMount: 'always',
    staleTime: 2_000,
  })
  const { data: testTypes = [] } = useQuery({
    queryKey: ['guided', 'test-types'],
    queryFn: ({ signal }) => guidedWorkflowApi.getTestTypes(signal),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const redwoodProvisioningStartedForBooking = useRef<string | null>(null)
  const paymentRequestRef = useRef<Promise<GuidedPaymentResult> | null>(null)
  const terminalPaymentRequestRef = useRef<Promise<GuidedTerminalPaymentResult> | null>(null)
  const terminalPaymentCancelRequestRef = useRef<Promise<GuidedTerminalPaymentCancelResult> | null>(null)
  const completedTerminalPaymentRef = useRef<string | null>(null)
  const paymentOperationRef = useRef<{ fingerprint: string; id: string } | null>(null)
  const undoPaymentRequestRef = useRef<Promise<GuidedUndoPaymentResult> | null>(null)
  const undoPaymentOperationRef = useRef<{ bookingId: string; id: string } | null>(null)
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
  const currentStepRef = useRef(currentStep)
  const selectedBookingIdRef = useRef(selectedBooking?.id ?? null)
  useEffect(() => {
    currentStepRef.current = currentStep
    selectedBookingIdRef.current = selectedBooking?.id ?? null
  }, [currentStep, selectedBooking?.id])
  const { data: referralProfile = null, refetch: refetchReferralProfile } = useQuery({
    queryKey: ['guided', 'referral-profile', selectedClientId],
    queryFn: ({ signal }) => guidedWorkflowApi.getReferralProfile(selectedClientId || '', signal),
    enabled: Boolean(selectedClientId),
    staleTime: 30_000,
  })
  const {
    data: redwoodProvisioning,
    isLoading: isRedwoodProvisioningLoading,
    refetch: refetchRedwoodProvisioning,
  } = useQuery({
    queryKey: ['guided', 'redwood-provisioning', selectedClientId, selectedTestTypeValue],
    queryFn: ({ signal }) =>
      guidedWorkflowApi.getRedwoodStatus(selectedClientId || '', selectedTestTypeValue || '', signal),
    enabled: currentStep === 'toxaccess' && Boolean(selectedClientId && selectedTestTypeValue),
    retry: false,
    staleTime: 1_000,
    refetchInterval: (query) => {
      const status = query.state.data
      if (!status || status.overallStatus === 'working') return 1_000
      return false
    },
  })
  const {
    data: outstandingPaymentBalances = [],
    isLoading: isLoadingOutstandingPaymentBalances,
    isFetching: isFetchingOutstandingPaymentBalances,
    isError: hasOutstandingPaymentBalanceError,
  } = useQuery({
    queryKey: ['guided', 'outstanding-payment-balances', selectedClientId],
    queryFn: ({ signal }) => guidedWorkflowApi.getOutstandingBalances(selectedClientId || '', signal),
    enabled:
      Boolean(selectedClientId) &&
      (currentStep === 'review' || currentStep === 'registration' || currentStep === 'payment'),
    refetchOnMount: 'always',
    retry: false,
    staleTime: 5_000,
  })
  const [paymentDraft, setPaymentDraft] = useState<ReturnType<typeof getPaymentDefaults> | null>(null)
  const [showAdditionalPayment, setShowAdditionalPayment] = useState(false)
  const [undoPaymentDialogOpen, setUndoPaymentDialogOpen] = useState(false)
  const [noPaymentDialogOpen, setNoPaymentDialogOpen] = useState(false)
  const [noHeadshotDialogOpen, setNoHeadshotDialogOpen] = useState(false)
  const headshotEditorRef = useRef<(() => void) | null>(null)
  const [verifiedClientMismatchKeys, setVerifiedClientMismatchKeys] = useState<Set<string>>(() => new Set())
  const [clientIdentityValidationErrorKey, setClientIdentityValidationErrorKey] = useState<string | null>(null)
  const [testTypeValidationErrorBookingId, setTestTypeValidationErrorBookingId] = useState<string | null>(null)
  const [referralDrawerOpen, setReferralDrawerOpen] = useState(false)
  const [testTypeDrawerOpen, setTestTypeDrawerOpen] = useState(false)
  const [testTypeDrawerSelection, setTestTypeDrawerSelection] = useState('')
  const [scheduleAction, setScheduleAction] = useState<{ action: ScheduleAction; booking: Booking } | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundOperationId, setRefundOperationId] = useState('')
  const scheduleActionMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.cancelBooking>[0]) =>
      guidedWorkflowApi.cancelBooking(input),
    retry: false,
  })
  const linkClientMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.linkClient>[0]) => guidedWorkflowApi.linkClient(input),
    retry: false,
  })
  const testTypeMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.setTestType>[0]) => guidedWorkflowApi.setTestType(input),
    retry: false,
  })
  const walkInMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.createWalkIn>[0]) => guidedWorkflowApi.createWalkIn(input),
    retry: false,
  })
  const paymentMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.recordPayment>[0]) =>
      guidedWorkflowApi.recordPayment(input),
    retry: false,
  })
  const terminalPaymentMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.startTerminalPayment>[0]) =>
      guidedWorkflowApi.startTerminalPayment(input),
    retry: false,
  })
  const terminalPaymentCancelMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.cancelTerminalPayment>[0]) =>
      guidedWorkflowApi.cancelTerminalPayment(input),
    retry: false,
  })
  const { data: terminalPaymentStatus = null } = useQuery({
    queryKey: ['guided', 'terminal-payment-status', query.terminalPaymentId],
    queryFn: ({ signal }) =>
      guidedWorkflowApi.getTerminalPaymentStatus({ paymentId: query.terminalPaymentId || undefined }, signal),
    enabled: currentStep === 'payment' && Boolean(query.terminalPaymentId),
    retry: 3,
    retryDelay: 1_000,
    staleTime: 0,
    refetchInterval: (query) => {
      if (query.state.error) return 3_000
      const status = query.state.data?.status
      return status === 'pending' || status === 'in-progress' ? 1_500 : false
    },
  })
  const undoPaymentMutation = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.undoPayment>[0]) => guidedWorkflowApi.undoPayment(input),
    retry: false,
  })
  const continueMutation = useMutation({
    mutationFn: (bookingId: string) => guidedWorkflowApi.getBookingContext(bookingId),
    retry: false,
  })
  const { mutate: ensureRedwood } = useMutation({
    mutationFn: (input: Parameters<typeof guidedWorkflowApi.ensureRedwood>[0]) =>
      guidedWorkflowApi.ensureRedwood(input),
    retry: false,
  })
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
  const terminalPaymentIsActive =
    Boolean(query.terminalPaymentId) &&
    (!terminalPaymentStatus ||
      terminalPaymentStatus.status === 'pending' ||
      terminalPaymentStatus.status === 'in-progress')
  const terminalPaymentFailed =
    terminalPaymentStatus?.status === 'failed' || terminalPaymentStatus?.status === 'cancelled'
  const clientReceiptEmail = selectedBooking?.client?.disableClientEmails
    ? null
    : selectedBooking?.client?.email || null
  const terminalReceiptEmail = selectedBooking?.client?.disableClientEmails
    ? null
    : terminalPaymentStatus?.receiptEmail || clientReceiptEmail
  const selectedClientMismatchKey = selectedBooking ? getClientIdentityMismatchKey(selectedBooking) : null
  const clientIdentityIsVerified =
    !selectedClientMismatchKey || verifiedClientMismatchKeys.has(selectedClientMismatchKey)
  const guidedWorkflowRef = useRef<HTMLDivElement>(null)

  useStepFocus({
    containerRef: guidedWorkflowRef,
    stepKey: currentStep,
  })

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
      queryFn: ({ signal }) => guidedWorkflowApi.getTodayBookings(signal),
      staleTime: 0,
    })
  useEffect(() => {
    if (
      terminalPaymentStatus?.status !== 'succeeded' ||
      completedTerminalPaymentRef.current === terminalPaymentStatus.id
    ) {
      return
    }

    completedTerminalPaymentRef.current = terminalPaymentStatus.id
    paymentOperationRef.current = null
    terminalPaymentRequestRef.current = null
    setPaymentDraft(null)
    setShowAdditionalPayment(false)

    toast.success(
      terminalPaymentStatus.receiptEmail
        ? `Payment approved. Stripe is sending the receipt to ${terminalPaymentStatus.receiptEmail}.`
        : 'Terminal payment approved.',
    )
    void queryClient.invalidateQueries({
      queryKey: ['guided', 'outstanding-payment-balances', selectedClientId],
    })
    void queryClient.fetchQuery({
      queryKey: ['guided', 'today-bookings'],
      queryFn: ({ signal }) => guidedWorkflowApi.getTodayBookings(signal),
      staleTime: 0,
    })

    if (currentStepRef.current === 'payment' && selectedBookingIdRef.current === selectedBooking?.id) {
      setQuery({
        bookingId: selectedBooking.id,
        step: 'toxaccess',
        terminalPaymentId: null,
      })
    }
  }, [queryClient, selectedBooking?.id, selectedClientId, setQuery, terminalPaymentStatus])
  useEffect(() => {
    if (currentStep !== 'toxaccess' || !selectedClientId || !selectedTestTypeValue) return
    if (!redwoodProvisioningBookingKey) return
    if (redwoodProvisioningStartedForBooking.current === redwoodProvisioningBookingKey) return

    redwoodProvisioningStartedForBooking.current = redwoodProvisioningBookingKey
    ensureRedwood(
      {
        clientId: selectedClientId,
        testTypeValue: selectedTestTypeValue,
      },
      {
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'ToxAccess setup could not be started.')
        },
        onSuccess: (result) => {
          if (!result.success && result.error) {
            toast.error(result.error)
          }
          void refetchRedwoodProvisioning()
        },
      },
    )
  }, [
    currentStep,
    ensureRedwood,
    redwoodProvisioningBookingKey,
    refetchRedwoodProvisioning,
    selectedClientId,
    selectedTestTypeValue,
  ])

  const handleSelectBooking = (booking: Booking) => {
    setPaymentDraft(getPaymentDefaults(booking))
    setShowAdditionalPayment(false)
    setQuery({
      bookingId: booking.id,
      step: getNextStep(booking),
      terminalPaymentId: null,
    })
  }

  const openExternalLink = (href: string | null | undefined) => {
    if (!href) return
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const openScheduleAction = (action: ScheduleAction, booking: Booking) => {
    if (action === 'cancel-refund') {
      setRefundAmount(normalizeRefundInput(booking.payment?.amountPaid ?? 0))
      setRefundOperationId(createOperationId())
    }
    setScheduleAction({ action, booking })
  }

  const handleConfirmScheduleAction = async () => {
    if (!scheduleAction) return

    const { action, booking } = scheduleAction
    const parsedRefundAmount = Number(refundAmount)
    if (
      action === 'cancel-refund' &&
      (!Number.isFinite(parsedRefundAmount) || parsedRefundAmount <= 0 || parsedRefundAmount > (booking.payment?.amountPaid ?? 0))
    ) {
      toast.error('Enter a refund amount within the available prepaid balance.')
      return
    }

    try {
      const result = await scheduleActionMutation.mutateAsync({
        action,
        bookingId: booking.id,
        ...(action === 'cancel-refund'
          ? {
              operationId: refundOperationId || createOperationId(),
              refundAmount: parsedRefundAmount,
            }
          : {}),
      })

      if (!result.success) {
        toast.error(
          result.error || 'Appointment action failed.',
          result.fallbackHref
            ? {
                action: {
                  label: result.fallbackHref.includes('stripe.com') ? 'Open Stripe' : 'Open Cal.com',
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
                  label: result.fallbackHref.includes('stripe.com') ? 'Open Stripe' : 'Open Cal.com',
                  onClick: () => openExternalLink(result.fallbackHref),
                },
              }
            : undefined,
        )
      } else {
        toast.success(
          action === 'cancel-refund'
            ? `Refunded ${preciseCurrency.format(result.refundedAmount ?? parsedRefundAmount)}.`
            : 'Appointment cancelled',
        )
      }

      setScheduleAction(null)
      setPaymentDraft(null)
      await refreshBookings()

      if (query.bookingId === booking.id) {
        setQuery({ step: 'schedule', bookingId: null })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Appointment action failed.')
    }
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

  const handleUseExistingClient = async (client: SimpleClient) => {
    if (!selectedBooking) return

    try {
      await linkClientMutation.mutateAsync({
        bookingId: selectedBooking.id,
        clientId: client.id,
      })
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Client could not be linked.')
    }
  }

  const handleSelectTestType = async (
    testTypeId: string,
    options?: { closeDrawer?: boolean; nextStep?: WorkflowStep },
  ) => {
    if (!selectedBooking) return

    try {
      const result = await testTypeMutation.mutateAsync({
        bookingId: selectedBooking.id,
        testTypeId,
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to set test type')
        return
      }

      setTestTypeValidationErrorBookingId(null)
      const selectedTestType = testTypes.find((testType) => testType.id === testTypeId || testType.value === testTypeId)
      queryClient.setQueryData<Booking[]>(['guided', 'today-bookings'], (current) =>
        current?.map((booking) =>
          booking.id === selectedBooking.id && selectedTestType
            ? {
                ...booking,
                bookingTestType: selectedTestType,
                needsTestType: false,
                testType: selectedTestType,
              }
            : booking,
        ),
      )
      const updatedBooking = selectedTestType
        ? {
            ...selectedBooking,
            bookingTestType: selectedTestType,
            needsTestType: false,
            testType: selectedTestType,
          }
        : selectedBooking
      setPaymentDraft(updatedBooking ? getPaymentDefaults(updatedBooking) : null)
      if (options?.closeDrawer) {
        setTestTypeDrawerOpen(false)
      }
      toast.success('Appointment test updated')
      setQuery({ step: options?.nextStep ?? 'payment', bookingId: selectedBooking.id })
      void refreshBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to set test type.')
    }
  }

  const openTestTypeDrawer = () => {
    setTestTypeDrawerSelection(selectedBooking?.bookingTestType?.id ?? selectedBooking?.testType?.id ?? '')
    setTestTypeDrawerOpen(true)
  }

  const handleCreateWalkInBooking = async (clientId: string, clientName: string) => {
    let result
    try {
      result = await walkInMutation.mutateAsync({ clientId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add the walk-in client.')
      return false
    }

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

  const handlePaymentNext = async (confirmedNoPayment = false) => {
    if (paymentRequestRef.current) return
    if (!selectedBooking?.testType) return
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
    if (payment.method === 'card' && amountReceived > 0) {
      toast.error('Send the card payment to Chx Desk before continuing.')
      return
    }
    if (isFetchingOutstandingPaymentBalances) {
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
    const allocationPreview = buildGuidedPaymentAllocationPreview({
      previousBalances: outstandingPaymentBalances,
      currentBalanceDue: payment.currentBalanceDue,
      amountReceived,
      clientCreditAvailable: selectedBooking.client.creditBalance ?? 0,
      clientCreditApplied: creditToApply,
    })
    const fingerprint = JSON.stringify({
      amountReceived,
      bookingId: selectedBooking.id,
      creditToApply,
      method: payment.method,
      sendReceipt: clientReceiptEmail ? payment.sendReceipt : false,
    })
    if (!paymentOperationRef.current || paymentOperationRef.current.fingerprint !== fingerprint) {
      paymentOperationRef.current = {
        fingerprint,
        id: createOperationId(),
      }
    }
    const operationId = paymentOperationRef.current.id
    const request = paymentMutation.mutateAsync({
      bookingId: selectedBooking.id,
      amountReceived,
      creditApplied: creditToApply,
      method: payment.method,
      operationId,
      sendReceipt: clientReceiptEmail ? payment.sendReceipt : false,
    })
    paymentRequestRef.current = request

    try {
      const result = await request

      if (!result.success) {
        paymentOperationRef.current = null
        toast.error(result.error || 'Failed to record payment')
        return
      }

      if (result.receipt?.sent) {
        toast.success(`Receipt emailed to ${result.receipt.email}.`)
      } else if (result.receipt && !result.receipt.sent) {
        toast.warning(result.receipt.error)
      }

      paymentOperationRef.current = null
      const previousAppliedAmount = allocationPreview.previousAllocations.reduce(
        (total, allocation) => total + allocation.amountApplied,
        0,
      )
      const guidedPaymentSummary =
        amountReceived > 0 || creditToApply > 0
          ? {
              appliedToBookingAmount: allocationPreview.currentAmountApplied,
              appliedToPreviousBalancesAmount: previousAppliedAmount,
              collectedAt: result.payment?.collectedAt || new Date().toISOString(),
              creditAppliedAmount: creditToApply,
              creditCreatedAmount: allocationPreview.creditAmount,
              method: payment.method,
              newMoneyAmount: amountReceived,
            }
          : null
      const nextClientCreditBalance = allocationPreview.clientCreditRemaining + allocationPreview.creditAmount

      queryClient.setQueryData<Booking[]>(['guided', 'today-bookings'], (current) =>
        current?.map((booking) =>
          booking.id === selectedBooking.id
            ? {
                ...booking,
                client: booking.client
                  ? {
                      ...booking.client,
                      creditBalance: nextClientCreditBalance,
                    }
                  : booking.client,
                guidedPaymentSummary,
                guidedPaymentTotal: amountReceived,
                payment: result.payment ?? booking.payment,
              }
            : booking,
        ),
      )

      setPaymentDraft(null)
      setShowAdditionalPayment(false)
      setNoPaymentDialogOpen(false)
      void queryClient.invalidateQueries({
        queryKey: ['guided', 'outstanding-payment-balances', clientId],
      })
      if (currentStepRef.current === 'payment' && selectedBookingIdRef.current === selectedBooking.id) {
        setQuery({ step: 'toxaccess', bookingId: selectedBooking.id, terminalPaymentId: null })
      }
      void refreshBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment.')
      void refreshBookings()
    } finally {
      if (paymentRequestRef.current === request) {
        paymentRequestRef.current = null
      }
    }
  }

  const handleTerminalPayment = async () => {
    if (terminalPaymentRequestRef.current || terminalPaymentMutation.isPending) return
    if (!selectedBooking?.testType || !selectedBooking.client?.id) {
      toast.error('Select or register the client before collecting payment.')
      return
    }
    if (!validateClientIdentity()) return
    if (!paymentAmountIsValid || amountReceived <= 0) {
      focusGuidedInvalidField()
      return
    }
    if (!creditAmountIsValid) {
      focusGuidedInvalidField()
      return
    }
    if (isFetchingOutstandingPaymentBalances) {
      toast.error('Wait for the existing balances to finish loading.')
      return
    }
    if (hasOutstandingPaymentBalanceError) {
      toast.error('Existing balances could not be loaded. Refresh and try again.')
      return
    }

    const fingerprint = JSON.stringify({
      amountReceived,
      bookingId: selectedBooking.id,
      creditToApply,
      method: 'terminal',
    })
    if (!paymentOperationRef.current || paymentOperationRef.current.fingerprint !== fingerprint) {
      paymentOperationRef.current = {
        fingerprint,
        id: createOperationId(),
      }
    }

    const request = terminalPaymentMutation.mutateAsync({
      amountReceived,
      bookingId: selectedBooking.id,
      creditApplied: creditToApply,
      operationId: paymentOperationRef.current.id,
    })
    terminalPaymentRequestRef.current = request

    try {
      const result = await request
      if (!result.success) {
        paymentOperationRef.current = null
        if (result.payment?.id) {
          setQuery({ terminalPaymentId: result.payment.id })
        }
        toast.error(result.error || 'The Terminal payment could not be started.')
        return
      }

      setQuery({ terminalPaymentId: result.payment.id })
      toast.info(`Payment sent to ${result.payment.readerLabel}. Waiting for the customer to tap or insert a card.`)
    } catch (error) {
      paymentOperationRef.current = null
      toast.error(error instanceof Error ? error.message : 'The Terminal payment could not be started.')
    } finally {
      if (terminalPaymentRequestRef.current === request) {
        terminalPaymentRequestRef.current = null
      }
    }
  }

  const handleCancelTerminalPayment = async (options: { goBack?: boolean } = {}) => {
    const paymentId = query.terminalPaymentId
    if (!paymentId) {
      if (options.goBack) {
        setQuery({ step: 'review', terminalPaymentId: null })
      }
      return true
    }
    if (terminalPaymentCancelRequestRef.current || terminalPaymentCancelMutation.isPending) return false

    const request = terminalPaymentCancelMutation.mutateAsync({ paymentId })
    terminalPaymentCancelRequestRef.current = request

    try {
      const result = await request
      if (!result.success) {
        toast.error(result.error || 'The Terminal payment could not be cancelled.')
        void queryClient.invalidateQueries({
          queryKey: ['guided', 'terminal-payment-status', paymentId],
        })
        return false
      }

      paymentOperationRef.current = null
      terminalPaymentRequestRef.current = null
      queryClient.setQueryData(['guided', 'terminal-payment-status', paymentId], result.payment)
      setQuery(options.goBack ? { step: 'review', terminalPaymentId: null } : { terminalPaymentId: null })
      toast.success('Terminal payment cancelled')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The Terminal payment could not be cancelled.')
      return false
    } finally {
      if (terminalPaymentCancelRequestRef.current === request) {
        terminalPaymentCancelRequestRef.current = null
      }
    }
  }

  const handleReviewNext = (confirmedNoHeadshot = false) => {
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
    if (!confirmedNoHeadshot && !selectedBooking.client.headshot) {
      setNoHeadshotDialogOpen(true)
      return
    }

    setPaymentDraft(getPaymentDefaults(selectedBooking))
    setQuery({ step: 'payment', bookingId: selectedBooking.id })
  }

  const handleUndoPayment = async () => {
    if (undoPaymentRequestRef.current) return
    if (!selectedBooking?.client?.id) return
    const clientId = selectedBooking.client.id
    if (!undoPaymentOperationRef.current || undoPaymentOperationRef.current.bookingId !== selectedBooking.id) {
      undoPaymentOperationRef.current = {
        bookingId: selectedBooking.id,
        id: createOperationId(),
      }
    }
    const request = undoPaymentMutation.mutateAsync({
      bookingId: selectedBooking.id,
      operationId: undoPaymentOperationRef.current.id,
    })
    undoPaymentRequestRef.current = request

    try {
      const result = await request
      if (!result.success) {
        undoPaymentOperationRef.current = null
        toast.error(result.error || 'Unable to undo this payment.')
        return
      }

      undoPaymentOperationRef.current = null
      const recordedPayment = selectedBooking.guidedPaymentSummary
      const restoredClientCredit = Math.max(
        0,
        (selectedBooking.client.creditBalance ?? 0) +
          (recordedPayment?.creditAppliedAmount ?? 0) -
          (recordedPayment?.creditCreatedAmount ?? 0),
      )
      const updatedBooking: Booking = {
        ...selectedBooking,
        client: {
          ...selectedBooking.client,
          creditBalance: restoredClientCredit,
        },
        guidedPaymentSummary: null,
        guidedPaymentTotal: 0,
        payment: 'payment' in result ? (result.payment ?? selectedBooking.payment) : selectedBooking.payment,
      }
      queryClient.setQueryData<Booking[]>(['guided', 'today-bookings'], (current) =>
        current?.map((booking) => (booking.id === selectedBooking.id ? updatedBooking : booking)),
      )

      setUndoPaymentDialogOpen(false)
      setShowAdditionalPayment(false)
      setPaymentDraft(getPaymentDefaults(updatedBooking))
      void queryClient.invalidateQueries({
        queryKey: ['guided', 'outstanding-payment-balances', clientId],
      })
      void refreshBookings()
      toast.success('Payment undone and balances restored')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to undo this payment.')
      void refreshBookings()
    } finally {
      if (undoPaymentRequestRef.current === request) {
        undoPaymentRequestRef.current = null
      }
    }
  }

  const handleContinueToCollection = async () => {
    if (!selectedBooking?.testType || !selectedBooking.client?.id) return
    if (!validateClientIdentity()) return

    try {
      if (!redwoodProvisioning?.canContinue) {
        toast.warning('ToxAccess setup is not verified. Complete the collection manually if needed.')
      }

      const context = await continueMutation.mutateAsync(selectedBooking.id)

      if (context.needsRegistration || !context.clientId) {
        if (currentStepRef.current !== 'toxaccess' || selectedBookingIdRef.current !== selectedBooking.id) return
        toast.error('Select or register the client before collection.')
        void refreshBookings()
        setQuery({ step: 'review', bookingId: selectedBooking.id })
        return
      }

      if (context.needsTestType || !context.testType) {
        if (currentStepRef.current !== 'toxaccess' || selectedBookingIdRef.current !== selectedBooking.id) return
        toast.error('Select the test type for this appointment before collection.')
        void refreshBookings()
        setQuery({ step: 'review', bookingId: selectedBooking.id })
        return
      }

      if (currentStepRef.current === 'toxaccess' && selectedBookingIdRef.current === selectedBooking.id) {
        router.push(getCollectionRoute(context.testType, context.clientId, selectedBooking.id))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Collection could not be started.')
    }
  }

  const goBackOneStep = async () => {
    if (currentStep === 'schedule') {
      onBack()
      return
    }

    if (currentStep === 'toxaccess') {
      setQuery({ step: 'payment' })
      return
    }

    if (currentStep === 'payment') {
      if (terminalPaymentIsActive) {
        await handleCancelTerminalPayment({ goBack: true })
        return
      }

      setQuery({ step: 'review', terminalPaymentId: null })
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
                item.label === 'Booking test' && testTypeValidationErrorBookingId === booking.id && !booking.testType
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
              onHeadshotCaptureReady={(openEditor) => {
                headshotEditorRef.current = openEditor
              }}
              onChangeClient={() => setBookingClientDrawerOpen(true)}
              onClientUpdated={(updatedClient) => {
                queryClient.setQueryData<Booking[]>(['guided', 'today-bookings'], (current) =>
                  current?.map((booking) =>
                    booking.id === selectedBooking.id && booking.client
                      ? {
                          ...booking,
                          client: {
                            ...booking.client,
                            ...updatedClient,
                            referralType: updatedClient.referralType ?? booking.client.referralType,
                          },
                        }
                      : booking,
                  ),
                )
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

        <Card className="rounded-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" />
              Today&apos;s Schedule
            </CardTitle>
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
                      'border-border bg-card grid w-full grid-cols-[minmax(0,1fr)_auto] rounded-lg border transition',
                      isCompleted ? 'border-border/60 bg-muted/40 text-muted-foreground' : 'hover:bg-muted/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectBooking(booking)}
                      disabled={isCompleted}
                      className="hover:text-foreground focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-md p-3 pr-2 text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
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
                      <span className="flex min-w-0 flex-col gap-1">
                        <span
                          className={cn(
                            'line-clamp-2 font-semibold',
                            isCompleted && 'line-through decoration-current/60 decoration-1',
                          )}
                        >
                          {booking.attendeeName}
                        </span>
                        <ScheduleInfoBadges
                          gender={booking.gender ?? booking.client?.gender}
                          isCompleted={isCompleted}
                          needsRegistration={needsRegistration}
                          paymentLabel={paymentLabel}
                        />
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
                    <div className="flex items-start p-3 pl-0">
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
                              onClick={() => openScheduleAction('cancel', booking)}
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
                              onClick={() => {
                                if (canRefund) openScheduleAction('cancel-refund', booking)
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

        <Card data-testid="guided-walk-in-card" className="border-l-primary overflow-hidden border-l-4">
          <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 flex-col gap-1">
              <div data-testid="guided-walk-in-title-row" className="flex items-center gap-2">
                <div className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                  <UserPlus className="size-4" />
                </div>
                <CardTitle className="text-lg">Walk-In Collection</CardTitle>
              </div>
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
            handleCreateWalkInBooking(client.id, client.fullName || `${client.firstName} ${client.lastName}`)
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
            {scheduleAction?.action === 'cancel-refund' && (
              <Field
                data-invalid={
                  !Number.isFinite(Number(refundAmount)) ||
                  Number(refundAmount) <= 0 ||
                  Number(refundAmount) > (scheduleAction.booking.payment?.amountPaid ?? 0)
                }
              >
                <FieldLabel htmlFor="guided-refund-amount">Refund amount</FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="guided-refund-amount"
                    type="number"
                    min="0.01"
                    max={scheduleAction.booking.payment?.amountPaid ?? 0}
                    step="0.01"
                    inputMode="decimal"
                    value={refundAmount}
                    onChange={(event) => setRefundAmount(event.target.value)}
                    aria-invalid={
                      !Number.isFinite(Number(refundAmount)) ||
                      Number(refundAmount) <= 0 ||
                      Number(refundAmount) > (scheduleAction.booking.payment?.amountPaid ?? 0)
                    }
                  />
                </InputGroup>
                <FieldDescription>
                  Available to refund: {preciseCurrency.format(scheduleAction.booking.payment?.amountPaid ?? 0)}
                </FieldDescription>
                <FieldError
                  errors={
                    Number(refundAmount) > (scheduleAction.booking.payment?.amountPaid ?? 0)
                      ? [{ message: 'Refund cannot exceed the available prepaid amount.' }]
                      : Number(refundAmount) <= 0 || !Number.isFinite(Number(refundAmount))
                        ? [{ message: 'Enter an amount greater than zero.' }]
                        : undefined
                  }
                />
              </Field>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleAction(null)}
                disabled={scheduleActionMutation.isPending}
              >
                Keep appointment
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmScheduleAction}
                disabled={
                  scheduleActionMutation.isPending ||
                  (scheduleAction?.action === 'cancel-refund' &&
                    (!Number.isFinite(Number(refundAmount)) ||
                      Number(refundAmount) <= 0 ||
                      Number(refundAmount) > (scheduleAction.booking.payment?.amountPaid ?? 0)))
                }
              >
                {scheduleActionMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {scheduleAction?.action === 'cancel-refund' && Number(refundAmount) > 0
                  ? `${actionCopy?.confirmLabel} ${preciseCurrency.format(Number(refundAmount))}`
                  : actionCopy?.confirmLabel}
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
      const moneyMethod =
        recordedPayment.method === 'stripe' ? 'Terminal card' : recordedPayment.method === 'card' ? 'Card' : 'Cash'

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
                <AlertDialog
                  open={undoPaymentDialogOpen}
                  onOpenChange={(open) => {
                    if (!undoPaymentMutation.isPending) setUndoPaymentDialogOpen(open)
                  }}
                >
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
                          ? recordedPayment.method === 'card' || recordedPayment.method === 'stripe'
                            ? 'Correct the record without refunding the card charge.'
                            : 'Remove this payment from the balance record.'
                          : 'Correct the record and restore the applied client credit.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel variant="outline" disabled={undoPaymentMutation.isPending}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        type="button"
                        variant="destructive"
                        onClick={handleUndoPayment}
                        disabled={undoPaymentMutation.isPending}
                      >
                        {undoPaymentMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Undoing...
                          </>
                        ) : (
                          'Undo payment'
                        )}
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
              Review the balance, then record cash or send a card payment to the Chx Desk Terminal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 p-4">
            {terminalPaymentIsActive && (
              <Alert variant="warning" className="sm:pr-56" data-testid="guided-terminal-payment-alert">
                <Loader2 className="animate-spin" />
                <AlertTitle>Waiting for payment on {terminalPaymentStatus?.readerLabel || 'Chx Desk'}</AlertTitle>
                <AlertDescription>
                  Ask the client to tap, insert, or swipe their card. This page will continue automatically after Stripe
                  confirms the payment.
                  {terminalReceiptEmail && (
                    <span className="mt-2 flex items-center gap-2">
                      <Mail /> Receipt will be emailed to {terminalReceiptEmail}.
                    </span>
                  )}
                </AlertDescription>
                <AlertAction>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleCancelTerminalPayment()}
                    disabled={terminalPaymentCancelMutation.isPending}
                    data-testid="cancel-terminal-payment-button"
                  >
                    {terminalPaymentCancelMutation.isPending ? (
                      <>
                        <Loader2 data-icon="inline-start" className="animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle data-icon="inline-start" />
                        Cancel terminal payment
                      </>
                    )}
                  </Button>
                </AlertAction>
              </Alert>
            )}
            {terminalPaymentFailed && terminalPaymentStatus && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Terminal payment did not complete</AlertTitle>
                <AlertDescription>
                  {terminalPaymentStatus.failureMessage || 'Try the card again or choose another payment method.'}
                </AlertDescription>
              </Alert>
            )}
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
                    disabled={terminalPaymentIsActive}
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
                      disabled={terminalPaymentIsActive}
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
                  disabled={terminalPaymentIsActive}
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
                      className="text-muted-foreground data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground h-11 opacity-60 data-pressed:opacity-100"
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
                      disabled={terminalPaymentIsActive}
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
                    disabled={terminalPaymentIsActive}
                  >
                    <ToggleGroupItem
                      value="cash"
                      aria-label="Cash payment method"
                      className="text-muted-foreground data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground h-12 px-3 opacity-60 data-pressed:opacity-100"
                    >
                      <Banknote />
                      Cash
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="card"
                      aria-label="Card payment method"
                      className="text-muted-foreground data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground h-12 px-3 opacity-60 data-pressed:opacity-100"
                    >
                      <CreditCard />
                      Card · Chx Desk
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </FieldGroup>
              {payment.method === 'card' && clientReceiptEmail && (
                <p className="text-muted-foreground flex w-full items-center gap-2 text-sm">
                  <Mail /> Email receipt sending to {clientReceiptEmail}
                </p>
              )}
              {payment.method === 'cash' && (
                <Field orientation="horizontal" data-disabled={!clientReceiptEmail || undefined} className="w-full">
                  <Checkbox
                    id="send-payment-receipt"
                    checked={clientReceiptEmail ? payment.sendReceipt : false}
                    disabled={!clientReceiptEmail}
                    onCheckedChange={(checked) =>
                      setPaymentDraft((current) => ({
                        ...(current ?? payment),
                        sendReceipt: checked === true,
                      }))
                    }
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="send-payment-receipt" className={cn(clientReceiptEmail && 'cursor-pointer')}>
                      {clientReceiptEmail ? `Email receipt to ${clientReceiptEmail}` : 'Email receipt unavailable'}
                    </FieldLabel>
                    {!clientReceiptEmail && (
                      <FieldDescription>Client emails are disabled for this profile.</FieldDescription>
                    )}
                  </FieldContent>
                </Field>
              )}
              {payment.method === 'card' && amountReceived > 0 && (
                <>
                  <Separator />
                  <div
                    className="bg-background flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    data-testid="guided-terminal-payment-action"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md border">
                        <CreditCard className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">Card payment · Chx Desk</p>
                        <p className="text-muted-foreground text-sm">
                          Send {currency.format(amountReceived)} to the reader. The footer only moves through the form.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={handleTerminalPayment}
                      disabled={
                        terminalPaymentIsActive ||
                        terminalPaymentMutation.isPending ||
                        terminalPaymentCancelMutation.isPending ||
                        !paymentAmountIsValid ||
                        !creditAmountIsValid ||
                        isFetchingOutstandingPaymentBalances ||
                        hasOutstandingPaymentBalanceError
                      }
                      data-testid="send-terminal-payment-button"
                    >
                      {terminalPaymentIsActive ? (
                        <>
                          <Loader2 data-icon="inline-start" className="animate-spin" />
                          Waiting for card...
                        </>
                      ) : terminalPaymentMutation.isPending ? (
                        <>
                          <Loader2 data-icon="inline-start" className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <CreditCard data-icon="inline-start" />
                          Send {currency.format(amountReceived)} to Chx Desk
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
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
  const cardPaymentRequiresTerminal = currentStep === 'payment' && payment.method === 'card' && amountReceived > 0

  const nextLabel =
    currentStep === 'review' || currentStep === 'registration'
      ? 'Continue to Payment'
      : currentStep === 'payment'
        ? cardPaymentRequiresTerminal
          ? terminalPaymentIsActive
            ? 'Payment pending'
            : 'Send card payment above'
          : amountReceived > 0 || creditToApply > 0
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
            !isFetchingOutstandingPaymentBalances &&
            !hasOutstandingPaymentBalanceError &&
            !terminalPaymentIsActive &&
            !cardPaymentRequiresTerminal,
          )
        : currentStep === 'toxaccess'
          ? Boolean(paymentRecorded && selectedBooking?.testType && selectedBooking.client?.id)
          : false

  const backLabel = currentStep === 'schedule' ? 'Cancel' : currentStep === 'payment' ? 'Back to Review' : 'Back'
  const footerIsPending =
    currentStep === 'payment'
      ? paymentMutation.isPending || terminalPaymentMutation.isPending || terminalPaymentCancelMutation.isPending
      : currentStep === 'toxaccess'
        ? continueMutation.isPending
        : false
  const paymentBalancesAreLoading = currentStep === 'payment' && isFetchingOutstandingPaymentBalances

  return (
    <>
      <div ref={guidedWorkflowRef} className="mx-auto flex w-full max-w-4xl flex-col px-2 pb-8 sm:px-4 md:px-0">
        {renderCurrentStep()}

        <div className="mt-6 flex items-start justify-between gap-4 border-t pt-4">
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              onClick={() => void goBackOneStep()}
              variant="outline"
              size="lg"
              data-testid="wizard-back-button"
              disabled={terminalPaymentMutation.isPending || terminalPaymentCancelMutation.isPending}
            >
              {terminalPaymentCancelMutation.isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ChevronLeft data-icon="inline-start" />
              )}
              {terminalPaymentCancelMutation.isPending ? 'Cancelling...' : backLabel}
            </Button>
            {currentStep === 'payment' && terminalPaymentIsActive && (
              <p className="text-muted-foreground max-w-52 text-xs">Going back cancels the terminal payment.</p>
            )}
          </div>

          {currentStep !== 'schedule' && (
            <Button
              type="button"
              onClick={
                currentStep === 'review' || currentStep === 'registration'
                  ? () => handleReviewNext()
                  : currentStep === 'payment'
                    ? () => handlePaymentNext()
                    : handleContinueToCollection
              }
              disabled={!canGoNext || footerIsPending}
              size="lg"
              data-testid="wizard-next-button"
            >
              {terminalPaymentIsActive ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Payment pending
                </>
              ) : footerIsPending ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Processing...
                </>
              ) : paymentBalancesAreLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading payment details...
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

      <AlertDialog
        open={noPaymentDialogOpen}
        onOpenChange={(open) => {
          if (!paymentMutation.isPending) setNoPaymentDialogOpen(open)
        }}
      >
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
            <AlertDialogCancel variant="outline" disabled={paymentMutation.isPending}>
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => handlePaymentNext(true)}
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Continuing...
                </>
              ) : (
                'Continue'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={noHeadshotDialogOpen} onOpenChange={setNoHeadshotDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Continue without a headshot?</AlertDialogTitle>
            <AlertDialogDescription>No headshot is on file for this client.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNoHeadshotDialogOpen(false)
                handleReviewNext(true)
              }}
            >
              Continue
            </Button>
            <AlertDialogAction
              type="button"
              onClick={() => {
                setNoHeadshotDialogOpen(false)
                headshotEditorRef.current?.()
              }}
            >
              <Camera className="size-4" />
              Capture headshot
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestTypeDrawerOpen(false)}
              disabled={testTypeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!testTypeDrawerSelection || testTypeMutation.isPending}
              onClick={() =>
                handleSelectTestType(testTypeDrawerSelection, {
                  closeDrawer: true,
                  nextStep: currentStep === 'payment' ? 'payment' : 'review',
                })
              }
            >
              {testTypeMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Test
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

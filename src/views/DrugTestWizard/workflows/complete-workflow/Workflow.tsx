'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import { toast } from 'sonner'
import { AlertCircle, CalendarDays, CheckCircle2, CreditCard, FlaskConical, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WizardHeader } from '../../components/main-wizard/WizardHeader'
import {
  getTodaysCollectionBookings,
  recordBookingPayment,
  refreshBookingClientContext,
} from './actions'

type Booking = Awaited<ReturnType<typeof getTodaysCollectionBookings>>[number]
type TestType = NonNullable<Booking['testType']>
type PaymentMethod = 'cash' | 'card' | 'not-paid'
type PaymentStatus = 'paid' | 'partial' | 'unpaid'

interface CompleteWorkflowProps {
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
  }).format(new Date(value))
}

function getPaymentDefaults(booking: Booking | null) {
  const amountDue = booking?.testType?.price ?? 0
  const existing = booking?.payment

  return {
    amountDue,
    amountPaid: typeof existing?.amountPaid === 'number' ? existing.amountPaid : amountDue,
    method: (existing?.method as PaymentMethod | undefined) ?? 'cash',
    status: (existing?.status as PaymentStatus | undefined) ?? 'paid',
    notes: typeof existing?.notes === 'string' ? existing.notes : '',
  }
}

function getCollectionRoute(testType: TestType, clientId: string, bookingId: string) {
  const params = new URLSearchParams({
    clientId,
    bookingId,
    testType: testType.value,
  })

  if (testType.category === 'instant') {
    params.set('workflow', 'instant-test')
    params.set('step', 'client')
    return `/admin/drug-test-upload?${params.toString()}`
  }

  params.set('workflow', 'collect-lab')
  params.set('step', 'client')
  return `/admin/drug-test-upload?${params.toString()}`
}

export function CompleteWorkflow({ onBack }: CompleteWorkflowProps) {
  const router = useRouter()
  const [query, setQuery] = useQueryStates({
    bookingId: parseAsString,
  })
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === query.bookingId) ?? null,
    [bookings, query.bookingId],
  )
  const [payment, setPayment] = useState(getPaymentDefaults(selectedBooking))
  const paymentRecorded = Boolean(selectedBooking?.payment?.status)

  useEffect(() => {
    let mounted = true

    getTodaysCollectionBookings()
      .then((result) => {
        if (!mounted) return
        setBookings(result)
        const selected = result.find((booking) => booking.id === query.bookingId) ?? null
        setPayment(getPaymentDefaults(selected))
      })
      .catch((error) => {
        console.error('Failed to load bookings:', error)
        toast.error('Failed to load today appointments')
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [query.bookingId])

  const refreshSelectedBooking = async () => {
    const result = await getTodaysCollectionBookings()
    setBookings(result)
  }

  const handleSavePayment = () => {
    if (!selectedBooking?.testType) return

    startTransition(async () => {
      const result = await recordBookingPayment({
        bookingId: selectedBooking.id,
        amountDue: payment.amountDue,
        amountPaid: Number(payment.amountPaid || 0),
        method: payment.status === 'unpaid' ? 'not-paid' : payment.method,
        status: payment.status,
        notes: payment.notes,
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to record payment')
        return
      }

      await refreshSelectedBooking()
      toast.success('Payment recorded')
    })
  }

  const handleRegisterClient = () => {
    if (!selectedBooking) return

    const params = new URLSearchParams({
      workflow: 'register-client',
      step: 'personalInfo',
      returnTo: 'complete-workflow',
      bookingId: selectedBooking.id,
    })

    router.push(`/admin/drug-test-upload?${params.toString()}`)
  }

  const handleContinueToCollection = () => {
    if (!selectedBooking?.testType || !selectedBooking.client?.id) return

    startTransition(async () => {
      const context = await refreshBookingClientContext(selectedBooking.id)

      if (context.needsRegistration || !context.clientId || !context.testType) {
        toast.error('Complete client registration and referral details before collection.')
        await refreshSelectedBooking()
        return
      }

      router.push(getCollectionRoute(context.testType, context.clientId, selectedBooking.id))
    })
  }

  return (
    <div className="space-y-8">
      <WizardHeader
        title="Complete Scheduled Collection"
        description="Start with today's Cal.com appointments, confirm referral and test details, collect payment, then continue collection."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" />
              Today
            </CardTitle>
            <CardDescription>Select the scheduled client who is ready for collection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading appointments...</p>
            ) : bookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No Cal.com appointments scheduled for today.</p>
            ) : (
              bookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => {
                    setPayment(getPaymentDefaults(booking))
                    setQuery({ bookingId: booking.id })
                  }}
                  className="border-border hover:bg-muted/50 data-[selected=true]:border-foreground data-[selected=true]:bg-muted flex w-full items-start justify-between rounded-lg border p-3 text-left transition"
                  data-selected={booking.id === selectedBooking?.id}
                >
                  <span>
                    <span className="block text-sm font-semibold">{booking.attendeeName}</span>
                    <span className="text-muted-foreground block text-xs">
                      {formatTime(booking.startTime)} to {formatTime(booking.endTime)}
                    </span>
                  </span>
                  {booking.needsRegistration ? (
                    <Badge variant="secondary">Register</Badge>
                  ) : booking.payment?.status ? (
                    <Badge>Paid</Badge>
                  ) : (
                    <Badge variant="outline">Payment</Badge>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!selectedBooking ? (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">
                Select an appointment to view referral, test, price, and payment steps.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedBooking.attendeeName}</CardTitle>
                  <CardDescription>{selectedBooking.attendeeEmail}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase">Referral</p>
                    <p className="text-sm">
                      {selectedBooking.referral
                        ? `${selectedBooking.referral.type}: ${selectedBooking.referral.name}`
                        : 'Registration needed'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase">Test</p>
                    <p className="text-sm">{selectedBooking.testType?.label ?? 'Set during registration'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase">Price</p>
                    <p className="text-sm">
                      {selectedBooking.testType ? currency.format(selectedBooking.testType.price) : 'Pending'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase">Client Record</p>
                    <p className="text-sm">
                      {selectedBooking.client
                        ? `${selectedBooking.client.firstName} ${selectedBooking.client.lastName}`
                        : 'Not registered'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {selectedBooking.needsRegistration ? (
                <Card className="border-amber-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserPlus className="size-5" />
                      Registration Required
                    </CardTitle>
                    <CardDescription>
                      Complete the full registration workflow before payment and collection.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button type="button" onClick={handleRegisterClient}>
                      Register Client
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CreditCard className="size-5" />
                        Payment
                      </CardTitle>
                      <CardDescription>
                        Payment status must be recorded before collection. Partial or unpaid balances can be tracked.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="payment-status">Status</Label>
                        <select
                          id="payment-status"
                          value={payment.status}
                          onChange={(event) =>
                            setPayment((current) => ({
                              ...current,
                              status: event.target.value as PaymentStatus,
                              amountPaid: event.target.value === 'unpaid' ? 0 : current.amountPaid,
                            }))
                          }
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          <option value="paid">Paid in full</option>
                          <option value="partial">Partially paid</option>
                          <option value="unpaid">Unpaid</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment-method">Method</Label>
                        <select
                          id="payment-method"
                          value={payment.status === 'unpaid' ? 'not-paid' : payment.method}
                          disabled={payment.status === 'unpaid'}
                          onChange={(event) =>
                            setPayment((current) => ({
                              ...current,
                              method: event.target.value as PaymentMethod,
                            }))
                          }
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="not-paid">Not paid</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount-due">Amount Due</Label>
                        <Input
                          id="amount-due"
                          type="number"
                          min={0}
                          value={payment.amountDue}
                          onChange={(event) =>
                            setPayment((current) => ({
                              ...current,
                              amountDue: Number(event.target.value || 0),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount-paid">Amount Paid</Label>
                        <Input
                          id="amount-paid"
                          type="number"
                          min={0}
                          value={payment.amountPaid}
                          disabled={payment.status === 'unpaid'}
                          onChange={(event) =>
                            setPayment((current) => ({
                              ...current,
                              amountPaid: Number(event.target.value || 0),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="payment-notes">Payment Notes</Label>
                        <Input
                          id="payment-notes"
                          value={payment.notes}
                          onChange={(event) =>
                            setPayment((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Optional balance or payment note"
                        />
                      </div>
                      <div className="flex items-center gap-3 md:col-span-2">
                        <Button type="button" onClick={handleSavePayment} disabled={isPending}>
                          {paymentRecorded ? 'Update Payment' : 'Record Payment'}
                        </Button>
                        {paymentRecorded && (
                          <span className="text-muted-foreground flex items-center gap-1 text-sm">
                            <CheckCircle2 className="size-4" />
                            Payment status recorded
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FlaskConical className="size-5" />
                        ToxAccess Reminder
                      </CardTitle>
                      <CardDescription>
                        After payment is recorded, collect the test in ToxAccess so Redwood can generate the report or lab screen request.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!paymentRecorded && (
                        <div className="bg-muted flex items-center gap-2 rounded-lg p-3 text-sm">
                          <AlertCircle className="size-4" />
                          Record payment status before continuing.
                        </div>
                      )}
                      <Button
                        type="button"
                        onClick={handleContinueToCollection}
                        disabled={!paymentRecorded || isPending}
                      >
                        Continue Collection
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Button type="button" variant="outline" onClick={onBack}>
        Back to All Workflows
      </Button>
    </div>
  )
}

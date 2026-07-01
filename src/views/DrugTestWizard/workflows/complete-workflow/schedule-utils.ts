export type GuidedScheduleStep = 'registration' | 'payment'
export type GuidedPaymentChoice = 'paid' | 'pre-paid' | 'still-owes'

export type GuidedScheduleBooking = {
  id: string
  needsRegistration: boolean
  needsTestType: boolean
  sampleCollection?: {
    status?: string | null
  } | null
  payment?: {
    status?: string | null
    method?: string | null
    amountDue?: number | null
    amountPaid?: number | null
  } | null
}

export function formatGuidedGender(value?: string | null) {
  if (value === 'male') return 'Male'
  if (value === 'female') return 'Female'
  if (value === 'other') return 'Other'
  if (value === 'prefer-not-to-say') return 'Prefer not to say'
  return 'Unknown'
}

export function getGuidedGenderBadgeClass(value?: string | null) {
  if (value === 'male')
    return 'border-blue-600/40 bg-blue-50 text-blue-900 dark:border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-100'
  if (value === 'female')
    return 'border-pink-600/40 bg-pink-50 text-pink-900 dark:border-pink-400/50 dark:bg-pink-500/20 dark:text-pink-100'
  return 'border-border bg-muted text-muted-foreground'
}

export function getGuidedPaymentChoice(
  payment: GuidedScheduleBooking['payment'] | undefined,
): GuidedPaymentChoice | null {
  if (!payment?.status) return null
  const amountDue = typeof payment.amountDue === 'number' ? payment.amountDue : 0
  const amountPaid = typeof payment.amountPaid === 'number' ? payment.amountPaid : 0

  if (payment.method === 'pre-paid' && (payment.status === 'paid' || amountDue === 0 || amountPaid >= amountDue)) {
    return 'pre-paid'
  }
  if (amountDue > 0 && amountPaid >= amountDue) return 'paid'
  if (payment.status === 'partial') return 'still-owes'
  if (payment.status === 'unpaid') return 'still-owes'
  if (payment.status === 'paid') return 'paid'
  return null
}

export function getGuidedPaymentLabel(booking: GuidedScheduleBooking) {
  if (booking.sampleCollection?.status === 'collected') return 'Collected'
  const choice = getGuidedPaymentChoice(booking.payment)
  if (choice === 'pre-paid') return 'Pre-paid'
  if (choice === 'still-owes') return 'Still owes'
  if (choice === 'paid') return 'Paid'
  return 'Unpaid'
}

export function getGuidedBookingNextStep(booking: GuidedScheduleBooking): GuidedScheduleStep {
  return booking.needsRegistration || booking.needsTestType ? 'registration' : 'payment'
}

export function getGuidedScheduleHref(booking: GuidedScheduleBooking) {
  const params = new URLSearchParams({
    workflow: 'guided',
    step: getGuidedBookingNextStep(booking),
    bookingId: booking.id,
  })

  return `/admin/drug-test-upload?${params.toString()}`
}

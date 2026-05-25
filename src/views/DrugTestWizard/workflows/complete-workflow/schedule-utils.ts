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
  } | null
}

export function getGuidedPaymentChoice(
  payment: GuidedScheduleBooking['payment'] | undefined,
): GuidedPaymentChoice | null {
  if (!payment?.status) return null
  if (payment.method === 'pre-paid') return 'pre-paid'
  if (payment.status === 'partial') return 'still-owes'
  return 'paid'
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

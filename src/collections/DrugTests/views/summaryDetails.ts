import type { DrugTest } from '@/payload-types'
import {
  confirmationHoldExpired,
  confirmationPaymentRequired,
  confirmationPrice,
  referralPaysConfirmation,
} from '../confirmation/policy'

export type SummaryOutcome = {
  substance: string
  label: string
  tone: 'success' | 'warning' | 'destructive' | 'pending'
  notes?: string
}

const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : null)

/** Itemize actual stored charges; do not guess a screening price from today's catalog. */
export function summaryCharges(test: Partial<DrugTest>) {
  const total = amount(test.payment?.amountDue)
  const selected = [...new Set(test.confirmationSubstances || [])]
  const recorded = amount(test.payment?.confirmationFeeDue)
  const confirmation = recorded ?? (selected.length || test.confirmationResults?.length ? null : 0)
  const screening =
    total !== null && confirmation !== null && confirmation <= total
      ? Math.round((total - confirmation) * 100) / 100
      : null
  const rows: Array<{ label: string; amount: number | null; detail?: string }> = [
    { label: 'Screening fee', amount: screening },
  ]
  if (confirmation !== null && confirmation > 0) {
    if (
      selected.length === 1 ||
      (test.testType && selected.length > 1 && confirmation === confirmationPrice(test.testType) * selected.length)
    ) {
      rows.push(
        ...selected.map((substance) => ({
          label: 'Confirmation',
          amount: confirmation / selected.length,
          detail: substance,
        })),
      )
    } else
      rows.push({
        label: selected.length ? `Confirmation (${selected.length} substances)` : 'Confirmation fee',
        amount: confirmation,
      })
  } else if (selected.length && confirmation === null) rows.push({ label: 'Confirmation fee', amount: null })
  return rows
}

/** Lead with the saved substance mapping and keep prescription names secondary. */
export function summaryMedications(test: Partial<DrugTest>) {
  const groups = new Map<string, { substance: string; names: string[]; required: boolean }>()
  for (const medication of test.medicationsArrayAtTestTime || []) {
    const substances = [...new Set(medication.detectedAs?.filter((value) => value !== 'none') || [])]
    for (const substance of substances.length ? substances : ['unmapped']) {
      const group = groups.get(substance) || { substance, names: [], required: false }
      if (medication.medicationName && !group.names.includes(medication.medicationName))
        group.names.push(medication.medicationName)
      group.required ||= !!medication.required
      groups.set(substance, group)
    }
  }
  return [...groups.values()]
}

export function summaryScreeningRows(test: Partial<DrugTest>): SummaryOutcome[] {
  const detected = [...new Set(test.detectedSubstances || [])].filter((value) => String(value) !== 'none')
  const positives: SummaryOutcome[] = detected
    .map<SummaryOutcome>((substance) => {
      const unexpected = test.unexpectedPositives?.includes(substance)
      const expected = test.expectedPositives?.includes(substance)
      return {
        substance,
        label: unexpected ? 'Unexpected' : expected ? 'Expected' : 'Needs review',
        tone: unexpected ? 'destructive' : expected ? 'success' : 'warning',
      }
    })
    .sort((a, b) => Number(b.tone === 'destructive') - Number(a.tone === 'destructive'))
  return [
    ...positives,
    ...[...new Set(test.unexpectedNegatives || [])]
      .filter((substance) => !detected.includes(substance))
      .map((substance) => ({
        substance,
        label: 'Not detected',
        tone: test.medicationsArrayAtTestTime?.some((med) => med.required && med.detectedAs?.includes(substance))
          ? ('destructive' as const)
          : ('warning' as const),
      })),
  ]
}

/** Display the stored balance, including unpaid referral invoices and admin payment exceptions. */
export function summaryPayment(test: Partial<DrugTest>) {
  const payment = test.payment
  const total = amount(payment?.amountDue)
  const paid = amount(payment?.amountPaid)
  const balance = amount(payment?.balanceDue) ?? (total !== null && paid !== null ? Math.max(0, total - paid) : null)
  const isPaid = balance === 0 && (payment?.status === 'paid' || (paid !== null && paid > 0))
  const label = !payment
    ? 'Not recorded'
    : isPaid
      ? 'Paid'
      : referralPaysConfirmation(test)
        ? 'Billed to referral'
        : balance === 0
          ? 'No balance due'
          : paid && paid > 0
            ? 'Partial'
            : payment.status === 'paid' && balance === null
              ? 'Paid'
              : 'Unpaid'
  return {
    total,
    paid,
    balance,
    label,
    variant:
      label === 'Paid'
        ? ('success' as const)
        : label === 'Partial' || label === 'Unpaid'
          ? ('warning' as const)
          : ('outline' as const),
  }
}

/** Keep the original screen and final confirmations separate. Unknown outcomes never become negative. */
export function summaryConfirmationRows(test: Partial<DrugTest>): SummaryOutcome[] {
  const raw = test.confirmationResults || []
  const substances = [
    ...new Set([...(test.confirmationSubstances || []), ...raw.map((row) => row.substance)].filter(Boolean)),
  ]
  return substances.map((substance) => {
    const matches = raw.filter((row) => row.substance === substance)
    const outcomes = [...new Set(matches.map((row) => String(row.result || '')).filter(Boolean))]
    const result = outcomes.length === 1 ? outcomes[0] : null
    const notes =
      matches
        .map((row) => row.notes)
        .filter(Boolean)
        .join('; ') || undefined
    if (!matches.length || !outcomes.length) return { substance, label: 'Pending', tone: 'pending', notes }
    if (result === 'confirmed-negative' || result === 'negative')
      return { substance, label: 'Confirmed negative', tone: 'success', notes }
    if (result === 'confirmed-positive' || result === 'positive') {
      const expected =
        test.expectedPositives?.includes(substance) ||
        test.medicationsArrayAtTestTime?.some((med) => med.detectedAs?.includes(substance))
      return {
        substance,
        label: expected ? 'Confirmed positive · Expected' : 'Confirmed positive · Unexpected',
        tone: expected ? 'success' : 'destructive',
        notes,
      }
    }
    return { substance, label: result === 'inconclusive' ? 'Inconclusive' : 'Needs review', tone: 'warning', notes }
  })
}

export function summaryConfirmationState(test: Partial<DrugTest>, rows: SummaryOutcome[], now = Date.now()) {
  const requested = test.confirmationDecision === 'request-confirmation'
  const received = rows.filter((row) => row.tone !== 'pending' && row.label !== 'Needs review').length
  const paymentRequired = confirmationPaymentRequired(test)
  const expired = !!test.testType && !test.testType.endsWith('-instant') && confirmationHoldExpired(test, now)
  if (rows.length && received === rows.length)
    return { label: 'Results received', variant: 'outline' as const, message: null }
  if (received)
    return {
      label: 'Partial results',
      variant: 'warning' as const,
      message: 'Remaining confirmation results are pending.',
    }
  if (rows.some((row) => row.label === 'Needs review'))
    return {
      label: 'Needs review',
      variant: 'warning' as const,
      message: 'Check the confirmation report for incomplete or conflicting outcomes.',
    }
  if (expired && (!requested || paymentRequired))
    return {
      label: 'Lab hold ended',
      variant: 'warning' as const,
      message: 'Contact the lab before requesting confirmation.',
    }
  if (requested && paymentRequired)
    return {
      label: 'Payment needed',
      variant: 'warning' as const,
      message: 'Staff can request confirmation after payment clears.',
    }
  if (requested && test.payment?.confirmationPaymentBypassed)
    return {
      label: 'Payment deferred',
      variant: 'warning' as const,
      message: 'An admin approved confirmation before payment. The balance is still due.',
    }
  if (requested && referralPaysConfirmation(test))
    return {
      label: 'Billed to referral',
      variant: 'outline' as const,
      message: 'Confirmation follows the referral billing arrangement. Final results are pending.',
    }
  if (requested)
    return {
      label: 'Confirmation selected',
      variant: 'warning' as const,
      message: 'Final results are pending. Coordinate the request with the lab.',
    }
  if (test.confirmationDecision === 'accept')
    return {
      label: 'Accepted',
      variant: 'outline' as const,
      message: 'Screening result accepted without confirmation.',
    }
  return {
    label: 'Decision pending',
    variant: 'warning' as const,
    message: test.testType?.endsWith('-instant')
      ? 'Request confirmation before specimen disposal.'
      : 'Request confirmation within the lab hold period.',
  }
}

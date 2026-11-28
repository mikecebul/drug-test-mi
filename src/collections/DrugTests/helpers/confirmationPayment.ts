import { allSubstanceOptions, type SubstanceValue } from '@/fields/substanceOptions'
import type { DrugTest } from '@/payload-types'

export const LAB_CONFIRMATION_FEE = 45
const supportedSubstances = new Set<string>(
  allSubstanceOptions.filter(({ value }) => value !== 'none').map(({ value }) => value),
)

export function getConfirmationSubstances(values?: readonly string[] | null) {
  return [...new Set(values)].filter((value): value is SubstanceValue => supportedSubstances.has(value))
}

export function getOutstandingConfirmations(
  selected: readonly SubstanceValue[],
  results?: DrugTest['confirmationResults'],
) {
  const completed = new Set(results?.filter(({ result }) => Boolean(result)).map(({ substance }) => substance))
  return selected.filter((substance) => !completed.has(substance))
}

export function priceConfirmation(
  payment: Partial<NonNullable<DrugTest['payment']>> | null | undefined,
  confirmationFeeDue: number,
): NonNullable<DrugTest['payment']> {
  const amountPaid = payment?.amountPaid ?? 0
  const screeningFee = (payment?.amountDue ?? 0) - (payment?.confirmationFeeDue ?? 0)
  const amountDue = Math.max(0, screeningFee + confirmationFeeDue)
  const balanceDue = Math.max(0, amountDue - amountPaid)
  return {
    ...payment,
    status:
      balanceDue <= 0
        ? 'paid'
        : payment?.status === 'invoiced'
          ? 'invoiced'
          : amountPaid > 0
            ? 'partial'
            : 'unpaid',
    amountDue,
    amountPaid,
    balanceDue,
    confirmationFeeDue,
  }
}

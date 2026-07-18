export type GuidedPaymentEntryMethod = 'cash' | 'card'

export type GuidedPaymentDraft = {
  amountReceived: string
  method: GuidedPaymentEntryMethod
}

export type GuidedOutstandingBalance = {
  id: string
  collectionDate: string
  testTypeLabel: string
  balanceDue: number
}

export type GuidedPaymentAllocation = GuidedOutstandingBalance & {
  amountApplied: number
  balanceRemaining: number
}

export type GuidedPaymentAllocationPreview = {
  previousBalanceTotal: number
  currentBalanceDue: number
  totalDue: number
  amountReceived: number
  previousAllocations: GuidedPaymentAllocation[]
  currentAmountApplied: number
  currentBalanceRemaining: number
  creditAmount: number
  remainingClientBalance: number
}

export type CompactPreviousAllocationRow =
  | {
      kind: 'detail'
      allocation: GuidedPaymentAllocation
    }
  | {
      kind: 'summary'
      key: string
      count: number
      amountDue: number
      amountApplied: number
      balanceRemaining: number
    }

function normalizeMoney(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

function addMoney(a: number, b: number) {
  return normalizeMoney(a + b)
}

function subtractMoney(a: number, b: number) {
  return normalizeMoney(a - b)
}

export function isValidGuidedPaymentAmount(value: string) {
  if (!value.trim()) return true
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0
}

export function parseGuidedPaymentAmount(value: string) {
  if (!isValidGuidedPaymentAmount(value) || !value.trim()) return 0
  return normalizeMoney(Number(value))
}

export function getGuidedPaymentQuickAmounts(currentBalanceDue: number, totalDue: number) {
  return Array.from(new Set([0, normalizeMoney(currentBalanceDue), normalizeMoney(totalDue)])).filter(
    (amount) => amount >= 0,
  )
}

export function buildGuidedPaymentAllocationPreview(input: {
  previousBalances: GuidedOutstandingBalance[]
  currentBalanceDue: number
  amountReceived: number
}): GuidedPaymentAllocationPreview {
  let remainingPayment = Math.max(0, normalizeMoney(input.amountReceived))
  const previousBalances = input.previousBalances.map((balance) => ({
    ...balance,
    balanceDue: Math.max(0, normalizeMoney(balance.balanceDue)),
  }))

  const previousAllocations = previousBalances.map<GuidedPaymentAllocation>((balance) => {
    const amountApplied = Math.min(balance.balanceDue, remainingPayment)
    remainingPayment = subtractMoney(remainingPayment, amountApplied)

    return {
      ...balance,
      amountApplied,
      balanceRemaining: Math.max(0, subtractMoney(balance.balanceDue, amountApplied)),
    }
  })

  const currentBalanceDue = Math.max(0, normalizeMoney(input.currentBalanceDue))
  const currentAmountApplied = Math.min(currentBalanceDue, remainingPayment)
  remainingPayment = subtractMoney(remainingPayment, currentAmountApplied)

  const previousBalanceTotal = previousBalances.reduce(
    (total, balance) => addMoney(total, balance.balanceDue),
    0,
  )
  const currentBalanceRemaining = Math.max(0, subtractMoney(currentBalanceDue, currentAmountApplied))
  const remainingPreviousBalance = previousAllocations.reduce(
    (total, allocation) => addMoney(total, allocation.balanceRemaining),
    0,
  )

  return {
    previousBalanceTotal,
    currentBalanceDue,
    totalDue: addMoney(previousBalanceTotal, currentBalanceDue),
    amountReceived: Math.max(0, normalizeMoney(input.amountReceived)),
    previousAllocations,
    currentAmountApplied,
    currentBalanceRemaining,
    creditAmount: Math.max(0, remainingPayment),
    remainingClientBalance: addMoney(remainingPreviousBalance, currentBalanceRemaining),
  }
}

function summarizeAllocations(
  allocations: GuidedPaymentAllocation[],
  start: number,
  end: number,
): CompactPreviousAllocationRow | null {
  const hidden = allocations.slice(start, end)
  if (!hidden.length) return null

  return {
    kind: 'summary',
    key: `summary-${start}-${end}`,
    count: hidden.length,
    amountDue: hidden.reduce((total, allocation) => addMoney(total, allocation.balanceDue), 0),
    amountApplied: hidden.reduce((total, allocation) => addMoney(total, allocation.amountApplied), 0),
    balanceRemaining: hidden.reduce((total, allocation) => addMoney(total, allocation.balanceRemaining), 0),
  }
}

export function compactPreviousPaymentAllocations(
  allocations: GuidedPaymentAllocation[],
): CompactPreviousAllocationRow[] {
  if (allocations.length <= 3) {
    return allocations.map((allocation) => ({ kind: 'detail' as const, allocation }))
  }

  const boundaryIndex = allocations.findIndex((allocation) => allocation.balanceRemaining > 0)
  const lastRelevantIndex = boundaryIndex === -1 ? allocations.length - 1 : boundaryIndex
  const detailIndexes = Array.from(new Set([0, lastRelevantIndex])).sort((a, b) => a - b)
  const rows: CompactPreviousAllocationRow[] = []
  let cursor = 0

  for (const detailIndex of detailIndexes) {
    const summary = summarizeAllocations(allocations, cursor, detailIndex)
    if (summary) rows.push(summary)
    rows.push({ kind: 'detail', allocation: allocations[detailIndex] })
    cursor = detailIndex + 1
  }

  const trailingSummary = summarizeAllocations(allocations, cursor, allocations.length)
  if (trailingSummary) rows.push(trailingSummary)

  return rows
}

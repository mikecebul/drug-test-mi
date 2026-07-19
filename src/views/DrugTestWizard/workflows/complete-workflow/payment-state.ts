export type GuidedPaymentEntryMethod = 'cash' | 'card'

export type GuidedPaymentDraft = {
  amountReceived: string
  creditToApply: string
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
  creditApplied: number
  newMoneyApplied: number
  balanceAfterCredit: number
  balanceRemaining: number
}

export type GuidedPaymentAllocationPreview = {
  previousBalanceTotal: number
  currentBalanceDue: number
  totalDue: number
  clientCreditAvailable: number
  clientCreditApplied: number
  clientCreditRemaining: number
  dueAfterCredit: number
  amountReceived: number
  previousAllocations: GuidedPaymentAllocation[]
  previousBalanceAfterCredit: number
  currentAmountApplied: number
  currentCreditApplied: number
  currentNewMoneyApplied: number
  currentBalanceAfterCredit: number
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
      creditApplied: number
      newMoneyApplied: number
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

export function getGuidedCreditMaximum(clientCreditAvailable: number, totalDue: number) {
  return Math.min(Math.max(0, normalizeMoney(clientCreditAvailable)), Math.max(0, normalizeMoney(totalDue)))
}

export function isValidGuidedCreditAmount(value: string, clientCreditAvailable: number, totalDue: number) {
  if (!isValidGuidedPaymentAmount(value)) return false
  return parseGuidedPaymentAmount(value) <= getGuidedCreditMaximum(clientCreditAvailable, totalDue)
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
  clientCreditAvailable?: number
  clientCreditApplied?: number
}): GuidedPaymentAllocationPreview {
  const previousBalances = input.previousBalances.map((balance) => ({
    ...balance,
    balanceDue: Math.max(0, normalizeMoney(balance.balanceDue)),
  }))
  const previousBalanceTotal = previousBalances.reduce((total, balance) => addMoney(total, balance.balanceDue), 0)
  const currentBalanceDue = Math.max(0, normalizeMoney(input.currentBalanceDue))
  const totalDue = addMoney(previousBalanceTotal, currentBalanceDue)
  const clientCreditAvailable = Math.max(0, normalizeMoney(input.clientCreditAvailable || 0))
  let remainingCredit = Math.min(
    getGuidedCreditMaximum(clientCreditAvailable, totalDue),
    Math.max(0, normalizeMoney(input.clientCreditApplied || 0)),
  )
  const clientCreditApplied = remainingCredit
  let remainingPayment = Math.max(0, normalizeMoney(input.amountReceived))

  function allocateBalance(balanceDue: number) {
    const creditApplied = Math.min(balanceDue, remainingCredit)
    remainingCredit = subtractMoney(remainingCredit, creditApplied)
    const balanceAfterCredit = Math.max(0, subtractMoney(balanceDue, creditApplied))
    const newMoneyApplied = Math.min(balanceAfterCredit, remainingPayment)
    remainingPayment = subtractMoney(remainingPayment, newMoneyApplied)

    return {
      creditApplied,
      newMoneyApplied,
      amountApplied: addMoney(creditApplied, newMoneyApplied),
      balanceAfterCredit,
      balanceRemaining: Math.max(0, subtractMoney(balanceAfterCredit, newMoneyApplied)),
    }
  }

  const previousAllocations = previousBalances.map<GuidedPaymentAllocation>((balance) => {
    const allocation = allocateBalance(balance.balanceDue)

    return {
      ...balance,
      ...allocation,
    }
  })

  const currentAllocation = allocateBalance(currentBalanceDue)
  const remainingPreviousBalance = previousAllocations.reduce(
    (total, allocation) => addMoney(total, allocation.balanceRemaining),
    0,
  )

  return {
    previousBalanceTotal,
    currentBalanceDue,
    totalDue,
    clientCreditAvailable,
    clientCreditApplied,
    clientCreditRemaining: subtractMoney(clientCreditAvailable, clientCreditApplied),
    dueAfterCredit: Math.max(0, subtractMoney(totalDue, clientCreditApplied)),
    amountReceived: Math.max(0, normalizeMoney(input.amountReceived)),
    previousAllocations,
    previousBalanceAfterCredit: previousAllocations.reduce(
      (total, allocation) => addMoney(total, allocation.balanceAfterCredit),
      0,
    ),
    currentAmountApplied: currentAllocation.amountApplied,
    currentCreditApplied: currentAllocation.creditApplied,
    currentNewMoneyApplied: currentAllocation.newMoneyApplied,
    currentBalanceAfterCredit: currentAllocation.balanceAfterCredit,
    currentBalanceRemaining: currentAllocation.balanceRemaining,
    creditAmount: Math.max(0, remainingPayment),
    remainingClientBalance: addMoney(remainingPreviousBalance, currentAllocation.balanceRemaining),
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
    creditApplied: hidden.reduce((total, allocation) => addMoney(total, allocation.creditApplied), 0),
    newMoneyApplied: hidden.reduce((total, allocation) => addMoney(total, allocation.newMoneyApplied), 0),
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

export function previousBillingMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
}

export function billingPeriodEnd(month: string, now = new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > previousBillingMonth(now)) {
    throw new Error('Choose a completed billing month in YYYY-MM format.')
  }
  const [year, number] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, number, 1))
  const localOffset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(next)
    .find((part) => part.type === 'timeZoneName')?.value
  const hours = Number(localOffset?.match(/GMT-(\d+)/)?.[1] || 5)
  next.setUTCHours(hours)
  return next.toISOString()
}

export function collectionDateInDetroit(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

import { CircleCheck, Clock4, RotateCcw, CircleX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { formatSubstance } from '@/lib/substances'
import type { DrugTest, Payment } from '@/payload-types'
import { summaryCharges, summaryPayment } from './summaryDetails'
import { hasMissingScreeningPayment, testPaymentHistory } from './paymentHistory'

const money = (amount: number | null) =>
  amount === null
    ? 'Not recorded'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
const date = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: APP_TIMEZONE,
      }).format(new Date(value))
    : null

export function TestPaymentCard({ test, records }: { test: Partial<DrugTest>; records?: Partial<Payment>[] | null }) {
  const payment = summaryPayment(test)
  const missingScreening = records !== null && hasMissingScreeningPayment(test, records || [])
  const history = records === null ? [] : testPaymentHistory(test, records || [])
  const confirmationPaid = Math.max(0, test.payment?.confirmationFeePaid || 0)
  const screeningPaid = Math.max(0, (payment.paid || 0) - confirmationPaid)
  const charges = summaryCharges(test)
  return (
    <Card size="sm" data-testid="test-summary-payment">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-bold">Payment</CardTitle>
        <Badge variant={payment.variant}>{payment.label}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Amount due</p>
          <p className="text-2xl font-semibold tracking-tight">{money(payment.balance)}</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Charges</h3>
          <dl className="flex flex-col gap-3 text-sm" aria-label="Test charges">
            {charges.map((charge, index) => {
              const amount = index === 0 && missingScreening ? null : charge.amount
              // Confirmation funding is recorded in aggregate, not per substance.
              const paid =
                index === 0
                  ? screeningPaid
                  : confirmationPaid >= (test.payment?.confirmationFeeDue || Infinity)
                    ? amount || 0
                    : 0
              const settled = amount !== null && paid >= amount
              return (
                <div key={index} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <dt className="font-medium">{charge.label}</dt>
                    {charge.detail && <dd className="text-muted-foreground">{formatSubstance(charge.detail, true)}</dd>}
                    {amount !== null && amount > 0 && (
                      <dd
                        className={`mt-1 flex items-center gap-1.5 ${settled ? 'text-success-foreground' : 'text-warning-foreground'}`}
                      >
                        {settled ? (
                          <CircleCheck className="size-4 shrink-0" aria-hidden />
                        ) : (
                          <Clock4 className="size-4 shrink-0" aria-hidden />
                        )}
                        {settled ? 'Paid' : paid > 0 ? `${money(Math.max(0, amount - paid))} due` : 'Due'}
                      </dd>
                    )}
                  </div>
                  <dd className="shrink-0 tabular-nums">{money(amount)}</dd>
                </div>
              )
            })}
          </dl>
          <Separator />
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{missingScreening ? 'Recorded charges' : 'Total charges'}</dt>
              <dd className="tabular-nums">{money(payment.total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{missingScreening ? 'Recorded payments' : 'Payments received'}</dt>
              <dd className="tabular-nums">{money(payment.paid)}</dd>
            </div>
          </dl>
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Payment history</h3>
          {records === null ? (
            <p className="text-muted-foreground text-sm">Payment history unavailable.</p>
          ) : history.length ? (
            <ul className="flex flex-col gap-3">
              {history.map((entry) => {
                const paid = entry.status === 'posted' || entry.status === 'legacy'
                const Icon =
                  entry.status === 'refunded'
                    ? RotateCcw
                    : entry.status === 'voided'
                      ? CircleX
                      : paid
                        ? CircleCheck
                        : Clock4
                const status =
                  entry.status === 'posted'
                    ? 'Paid'
                    : entry.status === 'pending'
                      ? 'Awaiting payment'
                      : entry.status === 'legacy'
                        ? 'Recorded before ledger'
                        : entry.status === 'voided'
                          ? 'Voided'
                          : 'Refunded'
                return (
                  <li key={entry.id} className="flex items-start gap-2 text-sm">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${paid ? 'text-success-foreground' : entry.status === 'pending' ? 'text-warning-foreground' : 'text-muted-foreground'}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{entry.label}</span>
                        <span className="shrink-0 tabular-nums">{money(entry.amount)}</span>
                      </div>
                      {(date(entry.date) || entry.method) && (
                        <p className="text-muted-foreground capitalize">
                          {[date(entry.date), entry.method].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className={paid ? 'text-success-foreground' : 'text-muted-foreground'}>{status}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No payment records.</p>
          )}
          {missingScreening && (
            <p className="text-muted-foreground text-sm">
              Earlier screening charges and payments are not recorded here.
            </p>
          )}
        </div>
        {test.payment?.confirmationPaymentBypassed && (
          <p className="text-muted-foreground text-sm">Payment deferred by an admin.</p>
        )}
        {test.payment?.notes && <p className="text-muted-foreground text-sm">{test.payment.notes}</p>}
      </CardContent>
    </Card>
  )
}

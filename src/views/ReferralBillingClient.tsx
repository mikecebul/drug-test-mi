'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { collectionDateInDetroit, currentBillingMonth } from '@/lib/referral-invoices/date'

type Referral = { id: string; name: string; relationTo: 'courts' | 'employers'; billingEmail: string }
type Preview = {
  referral: { name: string; billingEmail: string | null }
  items: Array<{ clientName: string; collectionDate: string; testType: string; amount: number }>
  amount: number
  unappliedAmount: number
  status: string
  invoiceId: string | null
  paidAt: string | null
  paymentMethod: 'stripe' | 'check' | null
  history: Array<{
    id: string
    billingMonth: string
    amount: number
    status: string
    billingEmail: string
    emailSentAt: string | null
    paidAt: string | null
    paymentMethod: 'stripe' | 'check' | null
    checkNumber: string | null
    hostedInvoiceUrl: string | null
    invoicePdfUrl: string | null
    replacesInvoiceNumber: string | null
  }>
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  emailSentAt: string | null
  replacesInvoiceNumber: string | null
  upcoming: boolean
  replacement: {
    items: Array<{ clientName: string; collectionDate: string; testType: string; amount: number }>
    amount: number
  } | null
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function InvoiceItemsTable({ items, status }: { items: Preview['items']; status?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Client</th>
            <th>Date</th>
            <th>Test</th>
            <th className="text-right">Balance</th>
            {status && <th className="text-right">State</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="py-2">{item.clientName}</td>
              <td>{collectionDateInDetroit(item.collectionDate)}</td>
              <td>{item.testType}</td>
              <td className="text-right">{money.format(item.amount)}</td>
              {status && (
                <td className="text-right">
                  <Badge variant={status === 'paid' ? 'success' : 'outline'}>
                    {status === 'paid' ? 'Paid' : status === 'sent' ? 'Invoiced' : 'Unpaid'}
                  </Badge>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReferralBillingClient({ referrals }: { referrals: Referral[] }) {
  const [selected, setSelected] = useState(0)
  const [month, setMonth] = useState(currentBillingMonth())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [checkInvoiceId, setCheckInvoiceId] = useState<string | null>(null)
  const [checkNumber, setCheckNumber] = useState('')
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [recordingCheck, setRecordingCheck] = useState(false)
  const referral = referrals[selected]

  async function loadPreview(target: Referral, billingMonth: string) {
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      const query = new URLSearchParams({ relationTo: target.relationTo, referralId: target.id, month: billingMonth })
      const response = await fetch(`/api/referral-invoices?${query}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to preview invoice.')
      setPreview(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to preview invoice.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!referral || !/^\d{4}-\d{2}$/.test(month)) return
    let cancelled = false
    const query = new URLSearchParams({ relationTo: referral.relationTo, referralId: referral.id, month })
    void fetch(`/api/referral-invoices?${query}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to preview invoice.')
        return data as Preview
      })
      .then((data) => {
        if (!cancelled) {
          setPreview(data)
          setLoading(false)
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to preview invoice.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [referral, month])

  async function send() {
    if (!referral || !preview || sending || replacing) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/referral-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationTo: referral.relationTo, referralId: referral.id, month }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send invoice.')
      await loadPreview(referral, month)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send invoice.')
    } finally {
      setSending(false)
    }
  }

  async function replace() {
    if (!referral || !preview?.replacement?.items.length || sending || replacing) return
    if (
      !window.confirm(
        'Void the current unpaid Stripe invoice and email a new PDF with the tests shown below? The old payment link will stop working.',
      )
    )
      return
    setReplacing(true)
    setError('')
    try {
      const response = await fetch('/api/referral-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationTo: referral.relationTo, referralId: referral.id, month, action: 'replace' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to replace invoice.')
      await loadPreview(referral, month)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to replace invoice.')
    } finally {
      setReplacing(false)
    }
  }

  async function recordCheck() {
    if (!referral || !checkInvoiceId || !checkDate || recordingCheck) return
    setRecordingCheck(true)
    setError('')
    try {
      const response = await fetch('/api/referral-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationTo: referral.relationTo,
          referralId: referral.id,
          month,
          action: 'record-check',
          invoiceId: checkInvoiceId,
          checkNumber,
          checkReceivedAt: new Date(`${checkDate}T12:00:00`).toISOString(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to record check payment.')
      setCheckInvoiceId(null)
      setCheckNumber('')
      await loadPreview(referral, month)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record check payment.')
    } finally {
      setRecordingCheck(false)
    }
  }

  return (
    <ShadcnWrapper className="py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Referral billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Preview upcoming billing for this month. Completed-month invoices are emailed with a printable PDF on the
          first of the following month, or you can email them here.
        </p>
      </div>
      {referrals.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            No referrals have monthly billing enabled. Open a court or employer referral and enable it in Monthly
            invoicing.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="referral">Referral</Label>
              <select
                id="referral"
                className="border-input bg-background mt-2 h-10 w-full rounded-md border px-3 text-sm"
                value={selected}
                onChange={(event) => {
                  setPreview(null)
                  setLoading(true)
                  setError('')
                  setSelected(Number(event.target.value))
                }}
              >
                {referrals.map((item, index) => (
                  <option key={`${item.relationTo}:${item.id}`} value={index}>
                    {item.name} ({item.relationTo === 'courts' ? 'Court' : 'Employer'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="month">Billing month</Label>
              <Input
                id="month"
                className="mt-2"
                type="month"
                max={currentBillingMonth()}
                value={month}
                onChange={(event) => {
                  setPreview(null)
                  setLoading(true)
                  setError('')
                  setMonth(event.target.value)
                }}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-destructive mb-4 text-sm">
              {error}
            </p>
          )}
          {loading ? (
            <p>Loading invoice preview…</p>
          ) : (
            preview && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {referral.name} · {month} {preview.upcoming ? '· Upcoming billing' : ''}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    To: {preview.referral.billingEmail || 'No billing email'} · Status:{' '}
                    {preview.upcoming ? 'Preview through today' : preview.status}
                  </p>
                  {preview.emailSentAt && (
                    <p className="text-muted-foreground text-sm">
                      PDF emailed {new Date(preview.emailSentAt).toLocaleString()}.
                    </p>
                  )}
                  {preview.replacesInvoiceNumber && (
                    <p className="text-muted-foreground text-sm">Replaces invoice {preview.replacesInvoiceNumber}.</p>
                  )}
                  {preview.unappliedAmount > 0 && (
                    <p role="alert" className="text-destructive text-sm">
                      {money.format(preview.unappliedAmount)} was paid after the client balance changed. Review a refund
                      or credit for this referral in Stripe.
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {preview.items.length ? (
                    <InvoiceItemsTable items={preview.items} status={preview.status} />
                  ) : (
                    <p className="text-muted-foreground text-sm">No uninvoiced balances for this period.</p>
                  )}
                  <p className="mt-4 text-right font-semibold">Total: {money.format(preview.amount)}</p>
                  <div className="mt-4 flex items-center justify-end gap-3">
                    {preview.hostedInvoiceUrl && (
                      <Button
                        variant="outline"
                        render={<a href={preview.hostedInvoiceUrl} target="_blank" rel="noreferrer" />}
                        nativeButton={false}
                      >
                        View or pay online
                      </Button>
                    )}
                    {preview.invoicePdfUrl && (
                      <Button
                        variant="outline"
                        render={<a href={preview.invoicePdfUrl} target="_blank" rel="noreferrer" />}
                        nativeButton={false}
                      >
                        View PDF
                      </Button>
                    )}
                    {preview.status === 'sent' && preview.invoiceId && (
                      <Button variant="outline" onClick={() => setCheckInvoiceId(preview.invoiceId)}>
                        Record check payment
                      </Button>
                    )}
                    <Button
                      onClick={send}
                      disabled={
                        !preview.items.length ||
                        preview.upcoming ||
                        (preview.status !== 'new' &&
                          preview.status !== 'preparing' &&
                          !(preview.status === 'sent' && !preview.emailSentAt)) ||
                        sending ||
                        replacing ||
                        !preview.referral.billingEmail
                      }
                    >
                      {sending ? 'Emailing…' : preview.status === 'sent' ? 'Email PDF' : 'Email invoice PDF'}
                    </Button>
                  </div>
                  {preview.upcoming && (
                    <p className="text-muted-foreground mt-3 text-right text-sm">
                      This total may change before the month closes. It can be invoiced next month.
                    </p>
                  )}
                  {preview.replacement && (
                    <section className="mt-8" aria-label="Replacement invoice preview">
                      <Separator className="mb-6" />
                      <h3 className="text-lg font-semibold">Replacement preview</h3>
                      <p className="text-muted-foreground mt-1 mb-3 text-sm">
                        Current unpaid balances through {month}, including tests added after the original invoice.
                        Replacing voids the old Stripe invoice and emails a new printable PDF.
                      </p>
                      {preview.replacement.items.length ? (
                        <InvoiceItemsTable items={preview.replacement.items} status="new" />
                      ) : (
                        <p className="text-muted-foreground text-sm">No unpaid tests remain for a replacement.</p>
                      )}
                      <p className="mt-4 text-right font-semibold">
                        Replacement total: {money.format(preview.replacement.amount)}
                      </p>
                      <div className="mt-4 flex justify-end">
                        <Button
                          variant="outline"
                          onClick={replace}
                          disabled={
                            !preview.replacement.items.length || replacing || sending || !preview.referral.billingEmail
                          }
                        >
                          {replacing ? 'Replacing…' : 'Void and email replacement'}
                        </Button>
                      </div>
                    </section>
                  )}
                </CardContent>
              </Card>
            )
          )}
          {preview && !loading && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Invoice history</CardTitle>
                <p className="text-muted-foreground text-sm">Sent, paid, and replaced invoices for {referral.name}.</p>
              </CardHeader>
              <CardContent>
                {preview.history.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No invoices have been created yet.</p>
                ) : (
                  <div className="divide-y">
                    {preview.history.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong>{invoice.billingMonth}</strong>
                            <Badge variant={invoice.status === 'paid' ? 'success' : 'outline'}>
                              {invoice.status === 'sent'
                                ? 'Invoiced'
                                : invoice.status === 'void'
                                  ? 'Voided'
                                  : invoice.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {money.format(invoice.amount)} · {invoice.billingEmail}
                            {invoice.paidAt ? ` · Paid ${new Date(invoice.paidAt).toLocaleDateString()}` : ''}
                            {invoice.paymentMethod === 'check'
                              ? ` by check${invoice.checkNumber ? ` #${invoice.checkNumber}` : ''}`
                              : ''}
                          </p>
                          {invoice.replacesInvoiceNumber && (
                            <p className="text-muted-foreground text-sm">Replaces {invoice.replacesInvoiceNumber}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {invoice.invoicePdfUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              render={<a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer" />}
                              nativeButton={false}
                            >
                              PDF
                            </Button>
                          )}
                          {invoice.status === 'sent' && (
                            <Button variant="outline" size="sm" onClick={() => setCheckInvoiceId(invoice.id)}>
                              Record check
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <p className="text-muted-foreground mt-4 text-sm">
            Edit billing settings in the{' '}
            <Link className="underline" href={`/admin/collections/${referral.relationTo}/${referral.id}`}>
              referral profile
            </Link>
            .
          </p>
        </>
      )}
      <Dialog
        open={Boolean(checkInvoiceId)}
        onOpenChange={(open) => !open && !recordingCheck && setCheckInvoiceId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record check payment</DialogTitle>
            <DialogDescription>
              Confirm the full check was received. This marks the Stripe invoice paid and posts payments to its tests.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <div>
              <Label htmlFor="check-received">Date received</Label>
              <Input
                id="check-received"
                type="date"
                value={checkDate}
                onChange={(event) => setCheckDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="check-number">Check number (optional)</Label>
              <Input
                id="check-number"
                value={checkNumber}
                maxLength={100}
                onChange={(event) => setCheckNumber(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInvoiceId(null)} disabled={recordingCheck}>
              Cancel
            </Button>
            <Button onClick={recordCheck} disabled={!checkDate || recordingCheck}>
              {recordingCheck ? 'Recording…' : 'Mark invoice paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ShadcnWrapper>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { collectionDateInDetroit, currentBillingMonth } from '@/lib/referral-invoices/date'

type Referral = { id: string; name: string; relationTo: 'courts' | 'employers'; billingEmail: string }
type Preview = {
  referral: { name: string; billingEmail: string | null }
  items: Array<{ clientName: string; collectionDate: string; testType: string; amount: number }>
  amount: number
  unappliedAmount: number
  status: string
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  emailSentAt: string | null
  upcoming: boolean
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function ReferralBillingClient({ referrals }: { referrals: Referral[] }) {
  const [selected, setSelected] = useState(0)
  const [month, setMonth] = useState(currentBillingMonth())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
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
    if (!referral || !preview || sending) return
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
                  {preview.unappliedAmount > 0 && (
                    <p role="alert" className="text-destructive text-sm">
                      {money.format(preview.unappliedAmount)} was paid after the client balance changed. Review a refund
                      or credit for this referral in Stripe.
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {preview.items.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="py-2">Client</th>
                            <th>Date</th>
                            <th>Test</th>
                            <th className="text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.items.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">{item.clientName}</td>
                              <td>{collectionDateInDetroit(item.collectionDate)}</td>
                              <td>{item.testType}</td>
                              <td className="text-right">{money.format(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                    <Button
                      onClick={send}
                      disabled={
                        !preview.items.length ||
                        preview.upcoming ||
                        (preview.status !== 'new' &&
                          preview.status !== 'preparing' &&
                          !(preview.status === 'sent' && !preview.emailSentAt)) ||
                        sending ||
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
                </CardContent>
              </Card>
            )
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
    </ShadcnWrapper>
  )
}

'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { parseAsString, useQueryState } from 'nuqs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { ClientSearchDialog } from '@/views/DrugTestWizard/workflows/components/client/ClientSearchDialog'
import { OptionalDetails } from '@/views/DrugTestWizard/components/OptionalDetails'
import { formatDobInput } from '@/lib/date-utils'
import { money } from '@/views/staff/summary-helpers'
import type { postAccountPayment } from '@/collections/Payments/services/accountPayment'

type PaymentOperation = {
  fingerprint: string
  id: string
  clientId: string
  clientName: string
  amount: number
  sendReceipt: boolean
}

type Context = {
  client: {
    id: string
    name: string
    firstName: string
    lastName: string
    dob?: string
    email?: string | null
    headshot?: string
    creditBalance: number
  }
  clientBalance: number
  balances: Array<{ id: string; label: string; amount: number }>
}
async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(
      data.message || 'Unable to confirm this request. Check payment history before trying again.',
    )
    Object.assign(error, {
      knownRejection: response.status === 400 || response.status === 401 || response.status === 403,
    })
    throw error
  }
  return data
}

export function CollectPaymentClient() {
  const [clientId, setClientId] = useQueryState('clientId', parseAsString)
  const [amount, setAmount] = useState('')
  const [sendReceipt, setSendReceipt] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof postAccountPayment>> | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const operation = useRef<PaymentOperation | null>(null)
  const [activeOperation, setActiveOperation] = useState<PaymentOperation | null>(null)
  const queryClient = useQueryClient()
  const { data, isFetching, isError } = useQuery({
    queryKey: ['account-payment', clientId],
    queryFn: ({ signal }) => jsonRequest<Context>(`/api/account-payments?clientId=${clientId}`, { signal }),
    enabled: Boolean(clientId),
    staleTime: 0,
    retry: false,
  })
  const entered = Number(amount)
  const valid =
    amount.trim() !== '' &&
    Number.isFinite(entered) &&
    entered > 0 &&
    Number.isSafeInteger(Math.round(entered * 100)) &&
    Math.abs(entered * 100 - Math.round(entered * 100)) < 0.00001
  const client = data?.client
  const collect = async () => {
    if ((!uncertain && (!clientId || !valid || isFetching)) || pending) return
    setPending(true)
    setError(null)
    const fingerprint = `${clientId}:${entered}`
    if (!uncertain && operation.current?.fingerprint !== fingerprint)
      operation.current = {
        fingerprint,
        id: crypto.randomUUID(),
        clientId: clientId!,
        clientName: client?.name || 'Selected client',
        amount: entered,
        sendReceipt: Boolean(client?.email && sendReceipt),
      }
    const request = operation.current
    setActiveOperation(request)
    if (!request) {
      setPending(false)
      return
    }
    try {
      const result = await jsonRequest<Awaited<ReturnType<typeof postAccountPayment>>>('/api/account-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: request.clientId,
          amount: request.amount,
          operationId: request.id,
          sendReceipt: request.sendReceipt,
        }),
      })
      setSaved(result)
      setUncertain(false)
      await queryClient.invalidateQueries({ queryKey: ['account-payment', request.clientId] })
    } catch (error) {
      setUncertain(!(error instanceof Error && 'knownRejection' in error && error.knownRejection))
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to confirm payment. Check payment history before trying again.',
      )
    } finally {
      setPending(false)
    }
  }
  if (activeOperation && activeOperation.clientId !== clientId && (pending || uncertain || saved)) {
    return (
      <ShadcnWrapper className="staff-interface mx-auto max-w-5xl space-y-4 py-6">
        <h1 className="text-3xl font-semibold">Account payment</h1>
        <Alert variant={saved ? 'success' : 'warning'}>
          <AlertTitle>{saved ? 'Payment recorded' : 'Payment needs verification'}</AlertTitle>
          <AlertDescription>
            This request belongs to {activeOperation.clientName}. Check its outcome before collecting another payment.
          </AlertDescription>
        </Alert>
        {uncertain && (
          <Button disabled={pending} onClick={collect}>
            Check payment status
          </Button>
        )}
        <Button
          variant="outline"
          render={<Link href={`/admin/collections/clients/${activeOperation.clientId}/summary`} />}
          nativeButton={false}
        >
          View client payment history
        </Button>
      </ShadcnWrapper>
    )
  }
  return (
    <ShadcnWrapper className="staff-interface mx-auto flex max-w-5xl flex-col gap-5 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Collect payment</h1>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          {client && (
            <>
              <Avatar className="size-16 rounded-lg">
                <AvatarImage src={client.headshot} alt={client.name} />
                <AvatarFallback>
                  {client.firstName[0]}
                  {client.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-xl font-semibold">{client.name}</p>
                <p className="text-muted-foreground text-sm">DOB {formatDobInput(client.dob) || 'Not recorded'}</p>
              </div>
            </>
          )}
          <ClientSearchDialog
            selectedClientId={clientId || ''}
            onSelect={(client) => {
              void setClientId(client.id)
              setAmount('')
              setSaved(null)
              setError(null)
              operation.current = null
              setActiveOperation(null)
            }}
          >
            <Button variant="outline" disabled={pending || uncertain}>
              {client ? 'Change client' : 'Select client'}
            </Button>
          </ClientSearchDialog>
          {client && (
            <Button
              variant="ghost"
              render={<Link href={`/admin/collections/clients/${client.id}/summary`} />}
              nativeButton={false}
            >
              View client
            </Button>
          )}
        </CardContent>
      </Card>
      {isFetching && <p className="text-muted-foreground text-sm">Loading client balance...</p>}
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Balance could not be loaded</AlertTitle>
          <AlertDescription>Refresh before recording payment.</AlertDescription>
        </Alert>
      )}
      {saved ? (
        <>
          <Alert variant="success">
            <AlertTitle>Payment recorded</AlertTitle>
            <AlertDescription>
              {money.format(saved.amount)} cash received.{' '}
              {saved.creditAdded > 0 ? `${money.format(saved.creditAdded)} added to account credit.` : ''}
            </AlertDescription>
          </Alert>
          {saved.receipt?.sent === false && (
            <Alert variant="warning">
              <AlertTitle>Receipt could not be sent</AlertTitle>
              <AlertDescription>
                The payment is saved. Check payment history before resending the receipt.
              </AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            render={<Link href={`/admin/collections/clients/${clientId}/summary`} />}
            nativeButton={false}
          >
            Return to client
          </Button>
        </>
      ) : (
        client &&
        data &&
        !isError && (
          <>
            <Card>
              <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
                <div>
                  <p className="text-muted-foreground text-sm">Client balance</p>
                  <p className="text-3xl font-semibold">{money.format(data.clientBalance)}</p>
                </div>
                <div className="border-t pt-5">
                  <Label className="mb-3 block">Payment method</Label>
                  <RadioGroup value="cash" className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="account-cash" value="cash" />
                      <Label htmlFor="account-cash">Cash</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="account-card" value="card" disabled />
                      <Label htmlFor="account-card" className="text-muted-foreground">
                        Card
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="account-amount">Amount received</Label>
                  <Input
                    id="account-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    disabled={pending || uncertain}
                    aria-invalid={(amount !== '' && !valid) || undefined}
                  />
                  {amount !== '' && !valid && (
                    <p className="text-destructive text-sm">
                      Enter a positive amount with no more than two decimal places.
                    </p>
                  )}
                </div>
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="account-receipt"
                      checked={sendReceipt}
                      onCheckedChange={(checked) => setSendReceipt(checked === true)}
                      disabled={pending || uncertain}
                    />
                    <Label htmlFor="account-receipt">Email receipt to {client.email}</Label>
                  </div>
                )}
                <div className="border-t pt-5">
                  <p className="text-muted-foreground text-sm">Remaining client balance</p>
                  <p className="text-2xl font-semibold">
                    {money.format(Math.max(0, data.clientBalance - (valid ? entered : 0)))}
                  </p>
                </div>
                <OptionalDetails title="Payment breakdown">
                  {data.balances.map((balance) => (
                    <p key={balance.id} className="text-sm">
                      {balance.label}: {money.format(balance.amount)}
                    </p>
                  ))}
                  <p className="text-muted-foreground text-sm">
                    Payment applies to the oldest eligible client balance first. Excess becomes account credit.
                  </p>
                  {valid && entered > data.clientBalance && (
                    <p>{money.format(entered - data.clientBalance)} will be added to account credit.</p>
                  )}
                </OptionalDetails>
              </CardContent>
            </Card>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <footer className="flex items-center justify-between gap-3 border-t pt-4">
              <Button
                variant="outline"
                disabled={pending || uncertain}
                render={<Link href={`/admin/collections/clients/${clientId}/summary`} />}
                nativeButton={false}
              >
                Cancel
              </Button>
              <Button disabled={!valid || pending || isFetching || isError} onClick={collect}>
                {pending
                  ? 'Recording...'
                  : uncertain
                    ? 'Check payment status'
                    : `Record ${money.format(valid ? entered : 0)} cash payment`}
              </Button>
            </footer>
          </>
        )
      )}
    </ShadcnWrapper>
  )
}

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, CheckCircle, XCircle, FileText, Calendar, AlertCircle } from 'lucide-react'
import { createCheckoutSessionAction, cancelSubscriptionAction } from './actions'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type SubscriptionViewProps = {
  client: any
  availableProducts: any[]
  payments: any[]
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active':
      return 'default'
    case 'past_due':
      return 'destructive'
    case 'canceled':
      return 'secondary'
    default:
      return 'outline'
  }
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function SubscriptionView({ client, availableProducts, payments }: SubscriptionViewProps) {
  const [isPending, startTransition] = useTransition()
  const [cancelingSubscription, setCancelingSubscription] = useState(false)

  const isSubscribed = client.recurringAppointments?.isRecurring
  const subscriptionStatus = client.recurringAppointments?.subscriptionStatus

  const handleSubscribe = async (priceId: string) => {
    startTransition(async () => {
      const result = await createCheckoutSessionAction(priceId)

      if (result.success && result.url) {
        window.location.href = result.url
      } else {
        toast.error(result.error || 'Failed to create checkout session')
      }
    })
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) {
      return
    }

    setCancelingSubscription(true)

    try {
      const result = await cancelSubscriptionAction()

      if (result.success) {
        toast.success('Subscription canceled successfully')
      } else {
        toast.error(result.error || 'Failed to cancel subscription')
      }
    } finally {
      setCancelingSubscription(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground">Manage your drug testing subscription</p>
      </div>

      {/* Current Subscription Status */}
      {isSubscribed && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={getStatusBadgeVariant(subscriptionStatus)}>
                  {subscriptionStatus?.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              {subscriptionStatus === 'past_due' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your payment is past due. Please update your payment method in Stripe to
                    continue your subscription.
                  </AlertDescription>
                </Alert>
              )}

              {client.recurringAppointments?.subscriptionStartDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Started:</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(
                      client.recurringAppointments.subscriptionStartDate,
                    ).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                </div>
              )}

              <div className="pt-4">
                <Button
                  onClick={handleCancelSubscription}
                  variant="destructive"
                  disabled={cancelingSubscription}
                  size="sm"
                >
                  {cancelingSubscription ? 'Canceling...' : 'Cancel Subscription'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Available Plans */}
      {!isSubscribed && availableProducts.length > 0 && (
        <div className="px-4 lg:px-6">
          <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {availableProducts.map((product) => (
              <Card key={product.id} className="relative">
                <CardHeader>
                  <CardTitle>{product.name}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">
                      {formatCurrency(product.pricePerMonth)}
                    </div>
                    <div className="text-sm text-muted-foreground">per month</div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">{product.testsPerMonth} tests per month</span>
                  </div>

                  <Button
                    onClick={() => handleSubscribe(product.stripePriceId)}
                    disabled={isPending}
                    className="w-full"
                  >
                    {isPending ? 'Loading...' : 'Subscribe'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {new Date(payment.billingDate).toLocaleDateString('en-US', {
                          timeZone: 'UTC',
                        })}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={payment.status === 'paid' ? 'default' : 'destructive'}>
                          {payment.status === 'paid' ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {payment.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.invoicePdf && (
                          <a
                            href={payment.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View PDF
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!isSubscribed && availableProducts.length === 0 && payments.length === 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Subscriptions Available</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                There are currently no subscription plans available. Please contact support for
                assistance.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

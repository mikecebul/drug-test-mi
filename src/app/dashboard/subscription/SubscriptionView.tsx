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
import {
  CreditCard,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  AlertCircle,
  DollarSign,
  Clock,
} from 'lucide-react'
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

  // Calculate stats
  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)
  const nextPayment = payments.find((p) => p.status === 'paid')
  const daysUntilNext = nextPayment
    ? Math.ceil(
        (new Date(nextPayment.billingDate).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null

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
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground">Manage your drug testing subscription and billing</p>
      </div>

      {/* Stats Cards - Only show if subscribed */}
      {isSubscribed && (
        <div className="px-4 lg:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-green-400 to-green-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-90">Status</p>
                    <p className="text-xl font-bold mt-1 capitalize">
                      {subscriptionStatus?.replace('_', ' ')}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-400 to-blue-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-90">Total Paid</p>
                    <p className="text-xl font-bold mt-1">{formatCurrency(totalPaid)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-400 to-purple-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-90">Payments</p>
                    <p className="text-xl font-bold mt-1">{payments.length}</p>
                  </div>
                  <FileText className="h-8 w-8 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-90">Next Billing</p>
                    <p className="text-xl font-bold mt-1">
                      {daysUntilNext !== null ? `${daysUntilNext} days` : 'N/A'}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Current Subscription */}
      {isSubscribed && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={getStatusBadgeVariant(subscriptionStatus)}>
                      {subscriptionStatus?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

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

                  {client.recurringAppointments?.nextAppointmentDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Next Test:</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(
                          client.recurringAppointments.nextAppointmentDate,
                        ).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCancelSubscription}
                    variant="destructive"
                    disabled={cancelingSubscription}
                    size="sm"
                  >
                    {cancelingSubscription ? 'Canceling...' : 'Cancel Subscription'}
                  </Button>
                </div>
              </div>

              {subscriptionStatus === 'past_due' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your payment is past due. Please update your payment method to continue your
                    subscription.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Available Plans */}
      {!isSubscribed && availableProducts.length > 0 && (
        <div className="px-4 lg:px-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Available Plans</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a subscription plan that fits your testing needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableProducts.map((product, index) => {
              const isPopular = index === 1 // Middle plan is popular
              return (
                <Card
                  key={product.id}
                  className={`relative ${isPopular ? 'border-primary shadow-lg' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Popular</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription className="line-clamp-2">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">
                          {formatCurrency(product.pricePerMonth)}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{product.testsPerMonth} tests per month</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>Flexible scheduling</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>Cancel anytime</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>Email notifications</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleSubscribe(product.stripePriceId)}
                      disabled={isPending}
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                    >
                      {isPending ? 'Loading...' : 'Subscribe Now'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Payment History
              </CardTitle>
              <CardDescription>View all your subscription payments and invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {new Date(payment.billingDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            timeZone: 'UTC',
                          })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={payment.status === 'paid' ? 'default' : 'destructive'}
                            className="flex items-center gap-1 w-fit"
                          >
                            {payment.status === 'paid' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {payment.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.invoicePdf ? (
                            <a
                              href={payment.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              View PDF
                              <FileText className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!isSubscribed && availableProducts.length === 0 && payments.length === 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Subscriptions Available</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                There are currently no subscription plans available. Please contact support for
                assistance.
              </p>
              <Button variant="outline" asChild>
                <a href="mailto:support@example.com">Contact Support</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

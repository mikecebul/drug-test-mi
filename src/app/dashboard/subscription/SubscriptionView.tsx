'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardDescriptionDiv,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table'

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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cancelingSubscription, setCancelingSubscription] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

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
    setCancelingSubscription(true)

    try {
      const result = await cancelSubscriptionAction()

      if (result.success) {
        toast.success(result.message || 'Subscription canceled successfully')
        setShowCancelDialog(false)
        // Refresh to show available product cards
        router.refresh()
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-green-400 to-green-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-90">Status</p>
                    <p className="mt-1 text-xl font-bold capitalize">
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
                    <p className="mt-1 text-xl font-bold">{formatCurrency(totalPaid)}</p>
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
                    <p className="mt-1 text-xl font-bold">{payments.length}</p>
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
                    <p className="mt-1 text-xl font-bold">
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
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center max-sm:justify-between sm:space-x-8">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={getStatusBadgeVariant(subscriptionStatus)}>
                      {subscriptionStatus?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  {client.recurringAppointments?.subscriptionStartDate && (
                    <div className="flex items-center max-sm:justify-between sm:space-x-8">
                      <span className="text-sm font-medium">Started:</span>
                      <span className="text-muted-foreground text-sm">
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
                      <span className="text-muted-foreground text-sm">
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
                    onClick={() => setShowCancelDialog(true)}
                    variant="destructive"
                    disabled={cancelingSubscription}
                    size="sm"
                  >
                    Cancel Subscription
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
            <p className="text-muted-foreground mt-1 text-sm">
              Choose a subscription plan that fits your testing needs
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                    <CardDescription className="line-clamp-2">
                      {product.description}
                    </CardDescription>
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
                        <CheckCircle className="text-primary h-4 w-4 flex-shrink-0" />
                        <span>{product.testsPerMonth} tests per month</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="text-primary h-4 w-4 flex-shrink-0" />
                        <span>Flexible scheduling</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="text-primary h-4 w-4 flex-shrink-0" />
                        <span>Cancel anytime</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="text-primary h-4 w-4 flex-shrink-0" />
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
      <PaymentHistory payments={payments} />

      {/* Empty State */}
      {!isSubscribed && availableProducts.length === 0 && payments.length === 0 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="bg-muted mb-4 rounded-full p-4">
                <Calendar className="text-muted-foreground h-8 w-8" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No Subscriptions Available</h3>
              <p className="text-muted-foreground mb-6 max-w-md text-center text-sm">
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

      {/* Cancel Subscription Alert Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <CardDescriptionDiv>
              Are you sure you want to cancel your subscription?
              <div className="bg-muted mt-3 space-y-2 rounded-md p-3 text-sm">
                <p className="font-medium">What happens next:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Your subscription will be canceled immediately</li>
                  <li>
                    You'll receive a prorated refund (up to 85% of monthly cost) for unused days
                  </li>
                  <li>Refunds are processed to your original payment method within 5-10 days</li>
                  <li>You'll lose access to scheduled appointments</li>
                </ul>
              </div>
              <p className="text-destructive mt-3 font-medium">This action cannot be undone.</p>
            </CardDescriptionDiv>
          </AlertDialogHeader>{' '}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelingSubscription}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={cancelingSubscription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelingSubscription ? 'Canceling...' : 'Yes, Cancel Subscription'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Payment History Component with Pagination
function PaymentHistory({ payments }: { payments: any[] }) {
  const columns: ColumnDef<any, any>[] = useMemo(
    () => [
      {
        accessorKey: 'billingDate',
        header: 'Date',
        cell: ({ getValue }) => {
          return new Date(getValue()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          })
        },
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ getValue }) => {
          return <span className="font-semibold">{formatCurrency(getValue())}</span>
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue()
          return (
            <Badge
              variant={status === 'paid' ? 'default' : 'destructive'}
              className="flex w-fit items-center gap-1"
            >
              {status === 'paid' ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {status.toUpperCase()}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'invoicePdf',
        header: 'Invoice',
        cell: ({ getValue }) => {
          const invoicePdf = getValue()
          return (
            <div className="text-right">
              {invoicePdf ? (
                <a
                  href={invoicePdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                >
                  View PDF
                  <FileText className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground text-sm">N/A</span>
              )}
            </div>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: payments,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  if (payments.length === 0) {
    return null
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payment History
          </CardTitle>
          <CardDescription>View all your subscription payments and invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          className={header.id === 'invoicePdf' ? 'text-right' : ''}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No payment history found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between py-4">
            <div className="text-muted-foreground text-sm">
              Showing{' '}
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                payments.length,
              )}{' '}
              of {payments.length} payments
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <div className="text-sm">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

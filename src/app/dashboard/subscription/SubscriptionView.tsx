'use client'

import type { Order, DrugTest, Transaction, Client } from '@/payload-types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { manageSubscription, cancelSubscription } from './actions'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface SubscriptionViewProps {
  enrollment: Order
  upcomingTests: DrugTest[]
  transactions: Transaction[]
  client: Client
}

export function SubscriptionView({
  enrollment,
  upcomingTests,
  transactions,
  client,
}: SubscriptionViewProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleManageSubscription = async () => {
    setIsLoading(true)
    setError('')

    try {
      const portalUrl = await manageSubscription()
      window.location.href = portalUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setIsLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setIsLoading(true)
    setError('')

    try {
      await cancelSubscription(enrollment.stripeSubscriptionId!)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      active: 'default',
      past_due: 'destructive',
      canceled: 'secondary',
      paused: 'outline',
    }
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Subscription</h1>
        {getStatusBadge(enrollment.subscriptionStatus || 'unknown')}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Subscription Details */}
      <Card>
        <CardHeader>
          <CardTitle>Enrollment Details</CardTitle>
          <CardDescription>Your current testing program enrollment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Testing Type</div>
              <div className="font-medium">
                {enrollment.testingType === 'fixed-saturday' && 'Fixed Saturday 11:10 AM'}
                {enrollment.testingType === 'random-1x' && 'Random 1x/week'}
                {enrollment.testingType === 'random-2x' && 'Random 2x/week'}
              </div>
            </div>
            {enrollment.testingType !== 'fixed-saturday' && (
              <>
                <div>
                  <div className="text-sm text-gray-500">Preferred Day</div>
                  <div className="font-medium capitalize">{enrollment.preferredDayOfWeek}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Preferred Time</div>
                  <div className="font-medium capitalize">
                    {enrollment.preferredTimeSlot?.replace('-', ' ')}
                  </div>
                </div>
              </>
            )}
            <div>
              <div className="text-sm text-gray-500">Amount</div>
              <div className="font-medium">
                ${((enrollment.amount || 0) / 100).toFixed(2)}/
                {typeof enrollment.items?.[0]?.product === 'object' &&
                enrollment.items[0].product?.testingFrequency
                  ? enrollment.items[0].product.testingFrequency
                  : 'month'}
              </div>
            </div>
            {enrollment.nextTestDate && (
              <div>
                <div className="text-sm text-gray-500">Next Test Date</div>
                <div className="font-medium">
                  {new Date(enrollment.nextTestDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleManageSubscription} disabled={isLoading}>
              Manage Payment Method
            </Button>
            {enrollment.subscriptionStatus === 'active' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isLoading}>
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your recurring testing program. You will continue to have
                      access until the end of your current billing period.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelSubscription}>
                      Yes, Cancel
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Tests */}
      {upcomingTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Tests</CardTitle>
            <CardDescription>Your scheduled drug tests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTests.map((test) => (
                <div
                  key={test.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded"
                >
                  <div>
                    <div className="font-medium">
                      {test.collectionDate
                        ? new Date(test.collectionDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Date TBD'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {test.collectionTime || 'Time TBD'}
                      {test.technician &&
                        typeof test.technician === 'object' &&
                        ` • ${test.technician.name}`}
                    </div>
                  </div>
                  <Badge variant="outline">{test.testType || 'Type TBD'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>Recent payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded"
                >
                  <div>
                    <div className="font-medium">
                      {transaction.createdAt
                        ? new Date(transaction.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Date unknown'}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">{transaction.status}</div>
                  </div>
                  <div className="font-medium">
                    ${((transaction.amount || 0) / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense } from 'react'
import { AccountForm } from './AccountForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Client } from '@/payload-types'

type AccountTabsProps = {
  user: Client
}

function AccountTabsContent({ user }: AccountTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'profile'

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'profile') {
      params.delete('tab')
    } else {
      params.set('tab', value)
    }
    const newUrl = params.toString() ? `/account?${params.toString()}` : '/account'
    router.push(newUrl, { scroll: false })
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Account</h1>
          <p className="text-muted-foreground">
            This is your account dashboard. Here you can view and update your account information.
          </p>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="edit">Edit Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-sm">{user?.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-sm">{user?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-sm">{user?.phone || 'Not provided'}</p>
                  </div>

                  {/* Probation/Court specific information */}
                  {user?.clientType === 'probation' && user?.courtInfo && (
                    <>
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Court Information</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Court Name</label>
                            <p className="text-sm">{user?.courtInfo?.courtName || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Probation Officer</label>
                            <p className="text-sm">{user?.courtInfo?.probationOfficerName || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Probation Officer Email</label>
                            <p className="text-sm">{user?.courtInfo?.probationOfficerEmail || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Employment specific information */}
                  {user?.clientType === 'employment' && user?.employmentInfo && (
                    <>
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Employment Information</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Employer</label>
                            <p className="text-sm">{user?.employmentInfo?.employerName || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                            <p className="text-sm">{user?.employmentInfo?.contactName || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Contact Email</label>
                            <p className="text-sm">{user?.employmentInfo?.contactEmail || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Self-pay specific information */}
                  {user?.clientType === 'self' && (
                    <>
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Testing Information</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Testing Type</label>
                            <p className="text-sm">Self-Pay / Individual Testing</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Preferred Contact Method</label>
                            <p className="text-sm">{user?.preferredContactMethod || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            <AccountForm />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-6 border-t">
          <Link
            href="/logout"
            className="text-destructive hover:underline"
          >
            Log out
          </Link>
        </div>
      </div>
    </div>
  )
}

export function AccountTabs({ user }: AccountTabsProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AccountTabsContent user={user} />
    </Suspense>
  )
}
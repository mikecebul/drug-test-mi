'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { useDashboardStatsQuery } from './queries'

export default function DrugTestStats() {
  const { user } = useAuth()
  const { data: stats, isLoading } = useDashboardStatsQuery()

  if (!user || user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pb-0">
      <div className="mb-6 space-y-6">
        {/* Quick Navigation Buttons - Always visible */}
        <div className="flex flex-wrap gap-3">
          <Button asChild size="xl" className="min-w-2xs gap-2">
            <Link href="/admin/drug-test-upload">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              Drug Test Collector
            </Link>
          </Button>
          <Button asChild variant="secondary" size="xl" className="min-w-2xs gap-2">
            <Link href="/admin/drug-test-tracker">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
                <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
              </svg>
              Drug Test Tracker
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="text-muted-foreground h-4 w-4"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="m22 21-3-3" />
                <path d="m13 13 3 3" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '-' : (stats?.totalClients ?? 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Drug Tests</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="text-muted-foreground h-4 w-4"
              >
                <path d="M6 2v20h12V2" />
                <path d="M9 5h6" />
                <path d="M9 8h6" />
                <path d="M9 11h6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '-' : (stats?.totalDrugTests ?? 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Incomplete Tests</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-orange-500"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {isLoading ? '-' : (stats?.incompleteDrugTests ?? 0)}
              </div>
              {!isLoading && stats && stats.incompleteDrugTests > 0 && (
                <p className="text-muted-foreground text-xs">Require attention</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Confirmation</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-yellow-500"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="m12 16 .01 0" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {isLoading ? '-' : (stats?.pendingConfirmation ?? 0)}
              </div>
              {!isLoading && stats && stats.pendingConfirmation > 0 && (
                <p className="text-muted-foreground text-xs">Awaiting lab results</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unresolved Alerts</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-red-500"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="m12 17 .01 0" />
              </svg>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${!isLoading && stats && stats.unresolvedAlerts > 0 ? 'text-red-600' : ''}`}
              >
                {isLoading ? '-' : (stats?.unresolvedAlerts ?? 0)}
              </div>
              {!isLoading && stats && stats.unresolvedAlerts > 0 && (
                <p className="text-muted-foreground text-xs">Require immediate attention</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ShadcnWrapper>
  )
}

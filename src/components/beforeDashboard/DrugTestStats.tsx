'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@payloadcms/ui'

interface StatsData {
  totalClients: number
  totalDrugTests: number
  incompleteDrugTests: number
  pendingConfirmation: number
}

export default function DrugTestStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatsData>({
    totalClients: 0,
    totalDrugTests: 0,
    incompleteDrugTests: 0,
    pendingConfirmation: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      if (!user) return

      try {
        const [clientsRes, drugTestsRes, incompleteRes, pendingRes] = await Promise.all([
          fetch('/api/clients?limit=0'),
          fetch('/api/drug-tests?limit=0'),
          fetch('/api/drug-tests?where[isComplete][equals]=false&limit=0'),
          fetch('/api/drug-tests?where[confirmationStatus][equals]=pending-confirmation&limit=0'),
        ])

        const [clients, drugTests, incomplete, pending] = await Promise.all([
          clientsRes.json(),
          drugTestsRes.json(),
          incompleteRes.json(),
          pendingRes.json(),
        ])

        setStats({
          totalClients: clients.totalDocs || 0,
          totalDrugTests: drugTests.totalDocs || 0,
          incompleteDrugTests: incomplete.totalDocs || 0,
          pendingConfirmation: pending.totalDocs || 0,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user])

  if (!user || user.collection !== 'admins') {
    return null
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card>
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
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="m22 21-3-3" />
            <path d="m13 13 3 3" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalClients}</div>
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
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M6 2v20h12V2" />
            <path d="M9 5h6" />
            <path d="M9 8h6" />
            <path d="M9 11h6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalDrugTests}</div>
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
            className="h-4 w-4 text-muted-foreground text-orange-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{stats.incompleteDrugTests}</div>
          {stats.incompleteDrugTests > 0 && (
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
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
            className="h-4 w-4 text-muted-foreground text-yellow-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="m12 16 .01 0" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{stats.pendingConfirmation}</div>
          {stats.pendingConfirmation > 0 && (
            <p className="text-xs text-muted-foreground">
              Awaiting lab results
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
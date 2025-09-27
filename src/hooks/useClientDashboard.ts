import { useQuery } from '@tanstack/react-query'

export type ClientDashboardData = {
  user: {
    id: string
    name: string
    email: string
    clientType: string
    isActive: boolean
    headshot?: any
  }
  stats: {
    totalTests: number
    compliantTests: number
    complianceRate: number
    activeMedications: number
  }
  nextAppointment?: {
    date: string
    type: string
  }
  recentTest?: {
    date: string
    result: string
    status: string
  }
  recurringSubscription?: {
    isActive: boolean
    frequency: string
    nextBilling: string
    status: string
  }
  medications: any[]
  drugScreenResults: any[]
  bookings: any[]
}

// Simple refetch function for client-side updates
async function refetchClientDashboard(): Promise<ClientDashboardData> {
  const response = await fetch('/api/clients/me', {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to refetch dashboard data')
  }

  const userData = await response.json()
  if (!userData.user) {
    throw new Error('User not authenticated')
  }

  // For client-side refetches, we can use a simplified version
  // or create a separate API endpoint for real-time updates
  const client = userData.user

  return {
    user: {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
      clientType: client.clientType || 'self',
      isActive: client.isActive || false,
      headshot: client.headshot,
    },
    stats: {
      totalTests: 0, // Would be updated with real data
      compliantTests: 0,
      complianceRate: 0,
      activeMedications: client.medications?.filter((med: any) => med.status === 'active').length || 0,
    },
    nextAppointment: undefined,
    recentTest: undefined,
    recurringSubscription: undefined,
    medications: client.medications || [],
    drugScreenResults: [],
    bookings: [],
  }
}

export function useClientDashboard(initialData?: ClientDashboardData) {
  return useQuery({
    queryKey: ['clientDashboard'],
    queryFn: refetchClientDashboard,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    initialData: initialData,
    // This data should be prefetched by the server component
    // so this will rarely actually fetch
  })
}

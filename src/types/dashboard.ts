
export type ClientDashboardData = {
  user: {
    id: string
    name: string
    email: string
    referralType: string
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

"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Pill,
  User,
  TrendingUp,
  AlertCircle,
  Shield,
} from "lucide-react"
import Link from "next/link"

export type DashboardData = {
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
    pendingTests: number
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
}

const getResultBadgeVariant = (result: string) => {
  // Blue (secondary): PASS results
  if (result === "Negative" || result === "Expected Positive") {
    return "secondary"
  }

  // White (outline): Confirmed Results, Pending, Inconclusive
  if (
    result.includes("Confirmed") ||
    result === "Pending" ||
    result === "Pending Confirmation" ||
    result === "Inconclusive" ||
    result === "Confirmation Inconclusive"
  ) {
    return "outline"
  }

  // Red (destructive): Any unexpected results or mixed results
  if (
    result === "Unexpected Positive" ||
    result === "Unexpected Negative" ||
    result === "Mixed Results" ||
    result === "Confirmed Mixed Results"
  ) {
    return "destructive"
  }

  return "outline"
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "Complete":
      return "default"
    case "Pending Lab Results":
      return "outline"
    case "Awaiting Decision":
      return "secondary"
    case "Active":
      return "default"
    default:
      return "outline"
  }
}

const getDaysUntil = (dateString: string) => {
  const targetDate = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)
  const diffTime = targetDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}


export function DashboardView({ data }: { data: DashboardData }) {
  const { user, stats, nextAppointment, recentTest, recurringSubscription } = data 
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.name}</h1>
            <p className="text-muted-foreground">
              Here&apos;s an overview of your testing activity and status
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 lg:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-400 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90">Total Tests</p>
                  <p className="text-2xl font-bold mt-1">{stats.totalTests}</p>
                </div>
                <FileText className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-400 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90">Compliant</p>
                  <p className="text-2xl font-bold mt-1">{stats.compliantTests}</p>
                  <p className="text-xs opacity-75">{stats.pendingTests} still pending</p>
                </div>
                <CheckCircle className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-400 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90">Compliance</p>
                  <p className="text-2xl font-bold mt-1">{stats.complianceRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90">Active Meds</p>
                  <p className="text-2xl font-bold mt-1">{stats.activeMedications}</p>
                  <p className="text-xs opacity-75">Documented</p>
                </div>
                <Pill className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/dashboard/appointments">
                <Button className="w-full justify-start" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Appointment
                </Button>
              </Link>
              <Link href="/dashboard/results">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  View Test Results
                </Button>
              </Link>
              <Link href="/dashboard/medications">
                <Button className="w-full justify-start" variant="outline">
                  <Pill className="w-4 h-4 mr-2" />
                  Manage Medications
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Next Appointment */}
          {nextAppointment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Next Appointment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">{nextAppointment.type}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(nextAppointment.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "UTC"
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="inline-flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    In {getDaysUntil(nextAppointment.date)} days
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Test Result */}
          {recentTest && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Recent Test Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(recentTest.date).toLocaleDateString("en-US", {
                        timeZone: "UTC"
                      })}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={getResultBadgeVariant(recentTest.result)}>
                        {recentTest.result}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(recentTest.status)}>
                        {recentTest.status}
                      </Badge>
                    </div>
                  </div>
                  <Link href="/dashboard/results">
                    <Button variant="outline" size="sm">
                      View All Results
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recurring Subscription Status */}
          {recurringSubscription && (
            <Card className="md:col-span-2 lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Subscription Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Frequency:</span>
                    <Badge variant="secondary">
                      {recurringSubscription.frequency}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status:</span>
                    <Badge variant={getStatusBadgeVariant(recurringSubscription.status)}>
                      {recurringSubscription.status}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Next billing:</p>
                    <p className="font-medium">
                      {new Date(recurringSubscription.nextBilling).toLocaleDateString("en-US", {
                        timeZone: "UTC"
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile Summary */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Client Type</p>
                    <Badge variant="outline" className="capitalize">
                      {user.clientType === "probation" ? "Probation/Court" : user.clientType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Documented Medications</p>
                    <p className="text-sm font-medium">{stats.activeMedications} active</p>
                  </div>
                  <Link href="/dashboard/profile">
                    <Button variant="outline" size="sm">
                      Edit Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Important Notes */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Testing Requirements</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Arrive 5 minutes before your appointment</li>
                  <li>• Photo taken at test time to verify ID</li>
                  <li>• Stay hydrated but avoid excessive fluids</li>
                  <li>• Update profile and inform staff of any new medications</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Privacy & Security</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Your results are shared only with authorized personnel</li>
                  <li>• All medication information is shared with referral</li>
                  <li>• Complete testing history is maintained for compliance</li>
                  <li>• Contact us immediately for any concerns</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
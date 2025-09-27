"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  CreditCard,
  CheckCircle,
  AlertCircle,
} from "lucide-react"

type Appointment = {
  id: string
  date: string
  time: string
  type: string
  status: "scheduled" | "completed" | "cancelled" | "missed"
  location: string
  notes?: string
}

type RecurringInfo = {
  isActive: boolean
  frequency: "weekly" | "biweekly" | "monthly"
  preferredDay: string
  preferredTime: string
  subscriptionStatus: "active" | "past_due" | "cancelled"
  nextBilling: string
}

const mockAppointments: Appointment[] = [
  {
    id: "1",
    date: "2025-09-27",
    time: "10:00 AM",
    type: "Weekly Drug Test",
    status: "scheduled",
    location: "Main Testing Center",
    notes: "Regular weekly screening"
  },
  {
    id: "2",
    date: "2025-10-04",
    time: "10:00 AM",
    type: "Weekly Drug Test",
    status: "scheduled",
    location: "Main Testing Center"
  },
  {
    id: "3",
    date: "2025-09-20",
    time: "10:30 AM",
    type: "Weekly Drug Test",
    status: "completed",
    location: "Main Testing Center"
  },
  {
    id: "4",
    date: "2025-09-13",
    time: "2:15 PM",
    type: "Weekly Drug Test",
    status: "completed",
    location: "Main Testing Center"
  }
]

const mockRecurringInfo: RecurringInfo = {
  isActive: true,
  frequency: "weekly",
  preferredDay: "Friday",
  preferredTime: "10:00 AM",
  subscriptionStatus: "active",
  nextBilling: "2025-09-30"
}

const getStatusBadgeVariant = (status: Appointment["status"]) => {
  switch (status) {
    case "scheduled":
      return "default"
    case "completed":
      return "secondary"
    case "cancelled":
      return "outline"
    case "missed":
      return "destructive"
    default:
      return "outline"
  }
}

const getStatusIcon = (status: Appointment["status"]) => {
  switch (status) {
    case "scheduled":
      return <Clock className="w-4 h-4" />
    case "completed":
      return <CheckCircle className="w-4 h-4" />
    case "cancelled":
    case "missed":
      return <AlertCircle className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

const getDaysFromNow = (dateString: string) => {
  const targetDate = new Date(dateString)
  const today = new Date()
  const diffTime = targetDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export default function AppointmentsPage() {
  const [appointments] = useState<Appointment[]>(mockAppointments)
  const [recurringInfo] = useState<RecurringInfo>(mockRecurringInfo)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)

  const upcomingAppointments = appointments.filter(apt =>
    apt.status === "scheduled" && new Date(apt.date) >= new Date()
  )

  const pastAppointments = appointments.filter(apt =>
    apt.status === "completed" || new Date(apt.date) < new Date()
  )

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground">
              Manage your drug testing appointments and recurring schedule
            </p>
          </div>
          <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Schedule Test
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Schedule New Appointment</DialogTitle>
                <DialogDescription>
                  Schedule a one-time drug test appointment.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground text-center">
                  Scheduling interface would be integrated with Calcom here.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Recurring Subscription Info */}
      {recurringInfo.isActive && (
        <div className="px-4 lg:px-6">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center text-green-800">
                <CreditCard className="w-5 h-5 mr-2" />
                Recurring Subscription Active
              </CardTitle>
              <CardDescription className="text-green-600">
                You have an active recurring appointment subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-green-600">Frequency</p>
                  <p className="font-medium text-green-800 capitalize">
                    {recurringInfo.frequency}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Preferred Day</p>
                  <p className="font-medium text-green-800">
                    {recurringInfo.preferredDay}s
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Preferred Time</p>
                  <p className="font-medium text-green-800">
                    {recurringInfo.preferredTime}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Next Billing</p>
                  <p className="font-medium text-green-800">
                    {new Date(recurringInfo.nextBilling).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <Button variant="outline" size="sm">
                  Modify Schedule
                </Button>
                <Button variant="outline" size="sm">
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upcoming Appointments */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Upcoming Appointments
            </CardTitle>
            <CardDescription>
              Your scheduled drug testing appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length > 0 ? (
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className={`border rounded-lg p-4 ${
                      getDaysFromNow(appointment.date) <= 1
                        ? "border-yellow-200 bg-yellow-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium">{appointment.type}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(appointment.date).toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric"
                            })} at {appointment.time}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {appointment.location}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getDaysFromNow(appointment.date) <= 1 && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                            Tomorrow
                          </Badge>
                        )}
                        <Badge variant={getStatusBadgeVariant(appointment.status)}>
                          {getStatusIcon(appointment.status)}
                          <span className="ml-1 capitalize">{appointment.status}</span>
                        </Badge>
                      </div>
                    </div>
                    {appointment.notes && (
                      <div className="mt-3 p-2 bg-muted rounded text-sm">
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No upcoming appointments scheduled</p>
                <Button className="mt-4" onClick={() => setShowScheduleDialog(true)}>
                  Schedule Your First Test
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Past Appointments */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Appointment History</CardTitle>
            <CardDescription>
              Your completed and past appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pastAppointments.length > 0 ? (
              <div className="space-y-3">
                {pastAppointments.slice(0, 5).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{appointment.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(appointment.date).toLocaleDateString()} at {appointment.time}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStatusBadgeVariant(appointment.status)}>
                      {getStatusIcon(appointment.status)}
                      <span className="ml-1 capitalize">{appointment.status}</span>
                    </Badge>
                  </div>
                ))}
                {pastAppointments.length > 5 && (
                  <div className="text-center pt-2">
                    <Button variant="outline" size="sm">
                      View All History
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No appointment history available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Important Information */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Testing Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-3">Before Your Appointment</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5" />
                    Arrive 15 minutes early
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5" />
                    Bring valid photo identification
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5" />
                    Stay normally hydrated
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5" />
                    Update medication list if changed
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3">Recurring Subscriptions</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CreditCard className="w-4 h-4 text-blue-500 mr-2 mt-0.5" />
                    Automatically schedules your tests
                  </li>
                  <li className="flex items-start">
                    <CreditCard className="w-4 h-4 text-blue-500 mr-2 mt-0.5" />
                    Preferred time slots guaranteed
                  </li>
                  <li className="flex items-start">
                    <CreditCard className="w-4 h-4 text-blue-500 mr-2 mt-0.5" />
                    Discounted rates available
                  </li>
                  <li className="flex items-start">
                    <CreditCard className="w-4 h-4 text-blue-500 mr-2 mt-0.5" />
                    Cancel or modify anytime
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
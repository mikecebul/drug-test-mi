export interface CalendarEvent {
  id: string
  title: string
  date: Date
  time: string
  duration?: number
  clientId: string
  clientName: string
  clientEmail: string
  isPrepaid: boolean
  isRecurring: boolean
  status?: 'confirmed' | 'cancelled' | 'rescheduled' | 'pending' | 'rejected'
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom'
  paymentStatus?: 'active' | 'past_due' | 'canceled' | 'pending'
  type: 'booking' | 'recurring'
}

export interface RBCEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: CalendarEvent & {
    displayTime: string
    displayDuration: string
  }
}

export interface ScheduleCalendarProps {
  events: CalendarEvent[]
}

export type ViewMode = 'month' | 'week' | 'day' | 'agenda'

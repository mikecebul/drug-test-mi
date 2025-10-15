import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMinutes, parse } from 'date-fns'
import type { CalendarEvent, RBCEvent } from './types'
import type { Booking, Appointment, Client } from '@/payload-types'

/**
 * Calculate next occurrence for a recurring appointment
 */
export function calculateNextOccurrence(appointment: Appointment, afterDate: Date = new Date()): Date | null {
  if (appointment.nextOccurrence) {
    const nextOcc = new Date(appointment.nextOccurrence)
    if (nextOcc > afterDate) {
      return nextOcc
    }
  }

  const startDate = new Date(appointment.startDate)

  // Check if appointment has ended
  if (appointment.endDate && new Date(appointment.endDate) < afterDate) {
    return null
  }

  if (startDate > afterDate) {
    return startDate
  }

  let nextDate = new Date(startDate)

  switch (appointment.frequency) {
    case 'weekly':
      while (nextDate <= afterDate) {
        nextDate.setDate(nextDate.getDate() + 7)
      }
      break
    case 'biweekly':
      while (nextDate <= afterDate) {
        nextDate.setDate(nextDate.getDate() + 14)
      }
      break
    case 'monthly':
      while (nextDate <= afterDate) {
        nextDate.setMonth(nextDate.getMonth() + 1)
      }
      break
    default:
      return null
  }

  // Check if calculated next occurrence is past the end date
  if (appointment.endDate && nextDate > new Date(appointment.endDate)) {
    return null
  }

  return nextDate
}

/**
 * Generate all occurrences of a recurring appointment within a date range
 */
export function generateOccurrencesInRange(
  appointment: Appointment,
  startDate: Date,
  endDate: Date
): Date[] {
  const occurrences: Date[] = []
  const appointmentStart = new Date(appointment.startDate)
  const appointmentEnd = appointment.endDate ? new Date(appointment.endDate) : null

  // Start from the appointment start date or range start, whichever is later
  let currentDate = appointmentStart > startDate ? new Date(appointmentStart) : new Date(startDate)

  // Align to the first valid occurrence based on frequency
  const daysDiff = Math.floor((currentDate.getTime() - appointmentStart.getTime()) / (1000 * 60 * 60 * 24))

  switch (appointment.frequency) {
    case 'weekly':
      const weeksToAdd = Math.ceil(daysDiff / 7)
      currentDate = new Date(appointmentStart)
      currentDate.setDate(currentDate.getDate() + weeksToAdd * 7)
      break
    case 'biweekly':
      const biweeksToAdd = Math.ceil(daysDiff / 14)
      currentDate = new Date(appointmentStart)
      currentDate.setDate(currentDate.getDate() + biweeksToAdd * 14)
      break
    case 'monthly':
      currentDate = new Date(appointmentStart)
      while (currentDate < startDate) {
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
      break
  }

  // Generate occurrences
  while (currentDate <= endDate) {
    // Check if this occurrence is within the appointment's active period
    if (currentDate >= appointmentStart && (!appointmentEnd || currentDate <= appointmentEnd)) {
      occurrences.push(new Date(currentDate))
    }

    // Move to next occurrence
    switch (appointment.frequency) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7)
        break
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14)
        break
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1)
        break
      default:
        return occurrences // Break for custom or unknown frequency
    }
  }

  return occurrences
}

/**
 * Convert Bookings to CalendarEvents
 */
export function bookingsToEvents(bookings: Booking[]): CalendarEvent[] {
  return bookings.map((booking) => {
    const client = typeof booking.relatedClient === 'object' ? booking.relatedClient : null

    return {
      id: booking.id,
      title: booking.title,
      date: new Date(booking.startTime),
      time: format(new Date(booking.startTime), 'h:mm a'),
      duration: parseInt(booking.type.replace(/\D/g, '')) || 30,
      clientId: client?.id || '',
      clientName: client ? `${client.firstName} ${client.lastName}` : booking.attendeeName,
      clientEmail: client?.email || booking.attendeeEmail,
      isPrepaid: false, // Removed - pre-payment no longer supported
      isRecurring: false,
      status: booking.status as CalendarEvent['status'],
      type: 'booking' as const,
    }
  })
}

/**
 * Convert Appointments to CalendarEvents within a date range
 */
export function appointmentsToEvents(
  appointments: Appointment[],
  startDate: Date,
  endDate: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const appointment of appointments) {
    if (!appointment.isActive) continue

    const client = typeof appointment.client === 'object' ? appointment.client : null
    if (!client) continue

    const occurrences = generateOccurrencesInRange(appointment, startDate, endDate)

    for (const occurrence of occurrences) {
      events.push({
        id: `${appointment.id}-${occurrence.getTime()}`,
        title: appointment.title,
        date: occurrence,
        time: appointment.time,
        duration: appointment.duration || 30,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        clientEmail: client.email,
        isPrepaid: false, // Removed - pre-payment no longer supported
        isRecurring: true,
        frequency: appointment.frequency as CalendarEvent['frequency'],
        paymentStatus: appointment.paymentStatus as CalendarEvent['paymentStatus'],
        type: 'recurring' as const,
      })
    }
  }

  return events
}

/**
 * Get events for a specific day
 */
export function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((event) => isSameDay(event.date, date))
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>()

  for (const event of events) {
    const dateKey = format(event.date, 'yyyy-MM-dd')
    const existing = grouped.get(dateKey) || []
    existing.push(event)
    grouped.set(dateKey, existing)
  }

  return grouped
}

/**
 * Parse time string to Date object on a given date
 * Handles formats like "10:00 AM", "2:30 PM", etc.
 */
function parseTimeOnDate(timeString: string, baseDate: Date): Date {
  try {
    // Try parsing with different formats
    const formats = ['h:mm a', 'h:mma', 'HH:mm', 'H:mm']

    for (const fmt of formats) {
      try {
        const parsed = parse(timeString, fmt, baseDate)
        if (!isNaN(parsed.getTime())) {
          return parsed
        }
      } catch (e) {
        // Try next format
      }
    }

    // Fallback: return baseDate if parsing fails
    return baseDate
  } catch (e) {
    return baseDate
  }
}

/**
 * Convert CalendarEvents to React Big Calendar event format
 */
export function calendarEventsToRBC(events: CalendarEvent[]): RBCEvent[] {
  return events.map((event) => {
    // Parse the time string and set it on the event date
    const startDate = parseTimeOnDate(event.time, event.date)

    // Calculate end date based on duration (default 30 minutes)
    const duration = event.duration || 30
    const endDate = addMinutes(startDate, duration)

    return {
      id: event.id,
      title: event.title,
      start: startDate,
      end: endDate,
      resource: {
        ...event,
        // Add computed display properties
        displayTime: event.time,
        displayDuration: `${duration} min`,
      },
    }
  })
}

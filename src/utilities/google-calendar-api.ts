import { google, type calendar_v3 } from 'googleapis'

const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export type GoogleCalendarEventRecord = {
  description?: string | null
  end?: string | null
  id: string
  metadata: Record<string, string>
  start?: string | null
  summary?: string | null
}

export type GoogleCalendarEventInput = {
  description?: string
  end: string
  location?: string
  metadata: Record<string, string>
  remindersUseDefault?: boolean
  start: string
  summary: string
  timeZone: string
}

type GoogleCalendarConfig = {
  calendarId: string
  clientEmail: string
  impersonatedUser?: string
  organizerEmail: string
  organizerName: string
  privateKey: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for Google Calendar synchronization.`)
  return value
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

export function getGoogleCalendarConfig(): GoogleCalendarConfig {
  const calendarId = requiredEnv('GOOGLE_CALENDAR_ID')
  const organizerEmail = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL?.trim() || calendarId

  return {
    calendarId,
    clientEmail: requiredEnv('GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL'),
    impersonatedUser: process.env.GOOGLE_CALENDAR_IMPERSONATED_USER?.trim() || undefined,
    organizerEmail,
    organizerName: process.env.GOOGLE_CALENDAR_ORGANIZER_NAME?.trim() || 'MI Drug Test',
    privateKey: normalizePrivateKey(requiredEnv('GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY')),
  }
}

function createCalendarClient(config: GoogleCalendarConfig) {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: [CALENDAR_EVENTS_SCOPE],
    subject: config.impersonatedUser,
  })
  return google.calendar({ auth, version: 'v3' })
}

function metadataFromEvent(event: calendar_v3.Schema$Event): Record<string, string> {
  const metadata = event.extendedProperties?.private
  if (!metadata) return {}

  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function eventDateTime(value: calendar_v3.Schema$EventDateTime | undefined): string | null {
  return value?.dateTime || value?.date || null
}

function toEventRecord(event: calendar_v3.Schema$Event): GoogleCalendarEventRecord | null {
  if (!event.id) return null
  return {
    description: event.description,
    end: eventDateTime(event.end),
    id: event.id,
    metadata: metadataFromEvent(event),
    start: eventDateTime(event.start),
    summary: event.summary,
  }
}

function requestBody(input: GoogleCalendarEventInput): calendar_v3.Schema$Event {
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: {
      dateTime: input.start,
      timeZone: input.timeZone,
    },
    end: {
      dateTime: input.end,
      timeZone: input.timeZone,
    },
    extendedProperties: {
      private: input.metadata,
    },
    reminders: {
      useDefault: input.remindersUseDefault ?? false,
    },
    transparency: 'opaque',
    visibility: 'private',
  }
}

export async function listGoogleCalendarEvents(input: {
  privateExtendedProperties?: string[]
  timeMax: string
  timeMin: string
}): Promise<GoogleCalendarEventRecord[]> {
  const config = getGoogleCalendarConfig()
  const calendar = createCalendarClient(config)
  const events: GoogleCalendarEventRecord[] = []
  let pageToken: string | undefined

  do {
    const response = await calendar.events.list({
      calendarId: config.calendarId,
      maxResults: 2500,
      pageToken,
      privateExtendedProperty: input.privateExtendedProperties,
      showDeleted: false,
      singleEvents: true,
      timeMax: input.timeMax,
      timeMin: input.timeMin,
    })
    for (const event of response.data.items || []) {
      const record = toEventRecord(event)
      if (record) events.push(record)
    }
    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return events
}

export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput,
): Promise<GoogleCalendarEventRecord> {
  const config = getGoogleCalendarConfig()
  const calendar = createCalendarClient(config)
  const response = await calendar.events.insert({
    calendarId: config.calendarId,
    requestBody: requestBody(input),
    sendUpdates: 'none',
  })
  const event = toEventRecord(response.data)
  if (!event) throw new Error('Google Calendar created an event without returning its ID.')
  return event
}

export async function updateGoogleCalendarEvent(input: {
  event: GoogleCalendarEventInput
  eventId: string
}): Promise<GoogleCalendarEventRecord> {
  const config = getGoogleCalendarConfig()
  const calendar = createCalendarClient(config)
  const response = await calendar.events.patch({
    calendarId: config.calendarId,
    eventId: input.eventId,
    requestBody: requestBody(input.event),
    sendUpdates: 'none',
  })
  const event = toEventRecord(response.data)
  if (!event) throw new Error('Google Calendar updated an event without returning its ID.')
  return event
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const config = getGoogleCalendarConfig()
  const calendar = createCalendarClient(config)
  await calendar.events.delete({
    calendarId: config.calendarId,
    eventId,
    sendUpdates: 'none',
  })
}

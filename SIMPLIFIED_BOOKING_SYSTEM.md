# Simplified Booking System Design

## Overview

Simplified Cal.com integration with:
- **Single 10-minute appointment type**
- **Recurring as a Cal.com option** (not pre-selected)
- **No pre-payment** - all payments handled through Cal.com
- **Individual rescheduling** of recurring occurrences

## Key Changes from Previous Design

### Before (Complex)
- Multiple test types (Instant/Lab)
- Pre-payment tracking
- Custom recurring logic
- 3-step booking dialog
- Cannot reschedule recurring occurrences

### After (Simplified)
- Single appointment type (10min drug test)
- Cal.com handles all payments
- Cal.com handles recurring setup
- Direct Cal.com embed
- Can reschedule any occurrence individually

## Cal.com Setup

### Single Event Type

Create ONE event type in Cal.com:
- **Name**: "Drug Test Appointment"
- **Duration**: 10 minutes
- **Recurring**: Enabled as an option (user chooses during booking)
- **Slug**: `drug-test-10min`
- **Payment**: Configure Stripe in Cal.com (optional)

### Required Fields
- Name (text, required)
- Email (email, required)
- Phone (phone, required)

### Webhook Configuration
- URL: `https://your-domain.com/api/webhooks/calcom`
- Events: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`
- Secret: From `CALCOM_WEBHOOK_SECRET`

## Data Model

### Bookings Collection

```typescript
{
  // Client info
  attendeeName: string
  attendeeEmail: string
  phone: string (required)
  relatedClient: relationship

  // Booking details
  title: string
  startTime: date
  endTime: date
  location: string
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'pending' | 'rejected'

  // Cal.com integration
  calcomBookingId: string (uid from Cal.com)
  calcomEventSlug: string (for rescheduling)
  recurringBookingUid: string | null (links occurrences)

  // Metadata
  createdViaWebhook: boolean
  webhookData: json
}
```

### Key Field: `recurringBookingUid`

Cal.com creates **multiple individual bookings** for recurring appointments:
- Each occurrence has its own `calcomBookingId` (uid)
- All share the same `recurringBookingUid`
- Enables grouping occurrences together
- Allows individual rescheduling of each occurrence

## Dashboard Views

### Tab 1: All Appointments (Default)
- Shows all bookings chronologically
- Upcoming and past
- Each occurrence listed separately
- Can reschedule/cancel individual occurrences

### Tab 2: Recurring Series
- Groups bookings by `recurringBookingUid`
- Shows series summary (e.g., "Weekly Drug Test - 8 occurrences")
- Actions:
  - **Cancel Series**: Cancels all remaining occurrences
  - **View All**: Expands to show individual occurrences
- Individual occurrences can still be rescheduled

## User Booking Flow

1. **Click "Book Appointment"**
2. **Cal.com embed opens** in dialog
3. **User selects**:
   - Date & time
   - One-time OR recurring (Cal.com checkbox)
   - If recurring: frequency (weekly, bi-weekly, etc.)
4. **Payment** (if configured in Cal.com)
5. **Webhook creates** booking(s) in Payload

## Recurring Bookings Explained

### Cal.com Behavior
- User checks "Recurring" during booking
- Cal.com creates N individual bookings
- Each has unique `uid`
- All share same `recurringBookingUid`

### In Our System
```
recurringBookingUid: "rec_123456"
├─ Booking 1: uid="abc" - 2025-01-15 10:00am
├─ Booking 2: uid="def" - 2025-01-22 10:00am
├─ Booking 3: uid="ghi" - 2025-01-29 10:00am
└─ Booking 4: uid="jkl" - 2025-02-05 10:00am
```

### Operations

**Reschedule Individual Occurrence:**
```typescript
// User clicks reschedule on Booking 2
POST /v2/bookings/def/reschedule
{
  "newStartTime": "2025-01-22T14:00:00Z",
  "newEndTime": "2025-01-22T14:10:00Z"
}
// Only Booking 2 is rescheduled, others unchanged
```

**Cancel Entire Series:**
```typescript
// User clicks "Cancel Series" on recurring group
POST /bookings/rec_123456/cancel
{
  "cancellationReason": "No longer needed"
}
// All 4 bookings are cancelled at once
```

## Implementation Files

### Core
- `src/collections/Bookings/index.ts` - Bookings collection (simplified)
- `src/app/(payload)/api/webhooks/calcom/route.ts` - Webhook handler
- `src/app/dashboard/appointments/page.tsx` - Server component
- `src/app/dashboard/appointments/AppointmentsViewClient.tsx` - Client UI

### Components
- `src/components/appointment-booking/AppointmentCard.tsx` - Individual booking card
- `src/components/appointment-booking/RecurringSeriesCard.tsx` - Recurring group card (NEW)
- `src/components/appointment-booking/CancelDialog.tsx` - Cancel confirmation
- `src/components/appointment-booking/RescheduleDialog.tsx` - Reschedule embed
- `src/components/appointment-booking/SimpleBookingDialog.tsx` - Direct Cal.com embed (NEW)

### Removed
- `src/components/appointment-booking/NewAppointmentDialog.tsx` - Complex 3-step dialog
- `src/globals/CompanyInfo/TestsRowLabel.tsx` - Test type configuration
- CompanyInfo `tests[]` array - No longer needed

## Environment Variables

```bash
# Cal.com Configuration
CALCOM_API_KEY=your_calcom_api_key
CALCOM_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_CALCOM_USERNAME=your-username
NEXT_PUBLIC_CALCOM_EVENT_SLUG=drug-test-10min
```

## Benefits of Simplified Design

1. **✅ Less Configuration** - One event type vs four
2. **✅ Less Code** - Remove test type selection logic
3. **✅ Better UX** - Direct to booking, no pre-questions
4. **✅ Flexible** - User decides one-time vs recurring
5. **✅ Reschedulable** - Any occurrence can be rescheduled
6. **✅ Payment Ready** - Cal.com handles Stripe integration
7. **✅ Maintainable** - Cal.com is source of truth

## Migration Notes

### Database Changes
- ✅ Removed: `isPrepaid`, `isRecurring`, `testType`, `recurringGroupId`
- ✅ Added: `recurringBookingUid` (from Cal.com)
- ✅ Kept: `calcomEventSlug` (for rescheduling)

### Cal.com Changes
- Delete old event types: `instant-35-single`, `instant-35-recurring`, `lab-40-single`, `lab-40-recurring`
- Create new event type: `drug-test-10min` with recurring enabled

### Frontend Changes
- Replace `NewAppointmentDialog` with `SimpleBookingDialog`
- Update dashboard to show recurring series grouped
- Add reschedule capability to all bookings (including recurring)

## Testing

### Test One-Time Booking
```bash
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "phone": "(231) 555-1234",
    "isRecurring": false
  }'
```

### Test Recurring Booking (Creates 4 Occurrences)
```bash
# Create first occurrence
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "phone": "(231) 555-1234",
    "isRecurring": true,
    "recurringBookingUid": "rec_test_12345"
  }'

# Repeat with different dates, same recurringBookingUid
```

## Next Steps

1. Update CompanyInfo to store single Cal.com URL
2. Create SimpleBookingDialog component
3. Create RecurringSeriesCard component
4. Update AppointmentsViewClient with new tabs
5. Remove old complex components
6. Update tests and documentation

# Cal.com Appointment System Implementation

This document outlines the Cal.com integration for managing drug test appointments.

## Overview

The system uses Cal.com as the single source of truth for appointments, supporting both one-time and recurring appointments with different test types (Instant 15-Panel vs Lab 11-Panel).

## Architecture

### 1. CompanyInfo Global Configuration

**File**: [src/globals/CompanyInfo/config.ts](src/globals/CompanyInfo/config.ts)

Added `tests` array field to configure available drug test types:
- Test name, description, and price
- Panel count (e.g., 11 or 15)
- Court location (e.g., "Charlevoix County" or "Other Courts")
- Checkboxes for `allowOneTime` and `allowRecurring`
- Cal.com event slugs for one-time and recurring appointments
- Icon type (instant or lab)
- Active status flag

**Row Label Component**: [src/globals/CompanyInfo/TestsRowLabel.tsx](src/globals/CompanyInfo/TestsRowLabel.tsx)

### 2. Enhanced Bookings Collection

**File**: [src/collections/Bookings/index.ts](src/collections/Bookings/index.ts)

Added fields:
- `phone` (required) - Phone number from booking
- `phoneHistory` (array) - Historical phone numbers for typo detection
- `isRecurring` (boolean) - Whether booking is part of recurring series
- `recurringGroupId` (string) - Cal.com recurring event ID
- `testType` (select) - instant or lab

**Phone Sync Hook**: [src/collections/Bookings/hooks/syncPhoneWithClient.ts](src/collections/Bookings/hooks/syncPhoneWithClient.ts)
- Automatically syncs phone number from booking to client
- Tracks phone number changes in history
- Detects potential typos

### 3. Cal.com API Service

**File**: [src/lib/calcom.ts](src/lib/calcom.ts)

Utilities for Cal.com integration:
- `cancelCalcomBooking()` - Cancel bookings via Cal.com API
- `getRescheduleUrl()` - Generate reschedule URLs for embeds
- `extractPhoneFromCalcomWebhook()` - Extract phone from webhook payload
- `detectRecurringBooking()` - Detect if booking is recurring
- `normalizePhoneNumber()` - Format phone numbers consistently
- `phoneNumbersMatch()` - Compare phone numbers

**Tests**: [src/lib/__tests__/calcom.test.ts](src/lib/__tests__/calcom.test.ts)

### 4. Enhanced Webhook Handler

**File**: [src/app/(payload)/api/webhooks/calcom/route.ts](src/app/(payload)/api/webhooks/calcom/route.ts)

Updated to:
- Extract and validate phone number (required)
- Detect recurring bookings from Cal.com metadata
- Store recurring group ID for linking bookings
- Handle `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED` events

### 5. Booking Dialog Components

**New Appointment Dialog**: [src/components/appointment-booking/NewAppointmentDialog.tsx](src/components/appointment-booking/NewAppointmentDialog.tsx)
- Step 1: Choose appointment type (one-time vs recurring)
- Step 2: Select test type from CompanyInfo
- Step 3: Embedded Cal.com booking with prefilled user data

**Appointment Card**: [src/components/appointment-booking/AppointmentCard.tsx](src/components/appointment-booking/AppointmentCard.tsx)
- Display booking details
- Show recurring badge
- Cancel/reschedule actions

**Cancel Dialog**: [src/components/appointment-booking/CancelDialog.tsx](src/components/appointment-booking/CancelDialog.tsx)
- Confirm cancellation with reason
- Handles both single and recurring cancellations

**Reschedule Dialog**: [src/components/appointment-booking/RescheduleDialog.tsx](src/components/appointment-booking/RescheduleDialog.tsx)
- Embedded Cal.com reschedule interface
- Only available for one-time appointments

### 6. Dashboard Appointments View

**Server Component**: [src/app/dashboard/appointments/page.tsx](src/app/dashboard/appointments/page.tsx)
- Fetches all bookings for authenticated client
- Loads test types from CompanyInfo
- Prepares client data for prefill

**Client Component**: [src/app/dashboard/appointments/AppointmentsViewClient.tsx](src/app/dashboard/appointments/AppointmentsViewClient.tsx)
- Upcoming and Past tabs
- Filter by date and status
- Cancel/reschedule actions
- New appointment button

### 7. Cancel Booking API

**File**: [src/app/api/bookings/cancel/route.ts](src/app/api/bookings/cancel/route.ts)

API endpoint for cancelling bookings:
- Calls Cal.com API to cancel booking
- Updates local booking status to 'cancelled'
- Adds cancellation reason to notes

### 8. Client Collection Updates

**File**: [src/collections/Clients/index.ts](src/collections/Clients/index.ts)

Changes:
- Made `phone` field required
- Added `phoneHistory` array field
- **Removed** legacy `recurringAppointments` group (lines 515-644)
  - Deprecated fields: `isRecurring`, `frequency`, `preferredDayOfWeek`, `preferredTimeSlot`
  - Deprecated Stripe fields: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`
  - Deprecated date fields: `nextAppointmentDate`, `subscriptionStartDate`

## Environment Variables

Add to `.env`:

```bash
# Cal.com Configuration
CALCOM_API_KEY=your_calcom_api_key
CALCOM_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_CALCOM_USERNAME=your-calcom-username
```

## Cal.com Setup

### 1. Create Event Types

Create four event types in Cal.com:
- `instant-35-single` - One-time Instant 15-Panel ($35)
- `instant-35-recurring` - Recurring Instant 15-Panel ($35)
- `lab-40-single` - One-time Lab 11-Panel ($40)
- `lab-40-recurring` - Recurring Lab 11-Panel ($40)

### 2. Configure Event Fields

Add custom fields to all event types:
- **Name** (text, required)
- **Email** (email, required)
- **Phone** (phone, required) ← **Important: Must be phone type**

### 3. Setup Webhook

Configure webhook in Cal.com:
- URL: `https://your-domain.com/api/webhooks/calcom`
- Events: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`
- Secret: Use the value from `CALCOM_WEBHOOK_SECRET`

### 4. Configure Tests in Admin

1. Go to Admin → Globals → Company Info
2. Add tests to the "Drug Test Types" array:

**Example: Instant 15-Panel**
```
Name: Instant 15-Panel
Description: For Charlevoix County Courts
Price: 35
Panel Count: 15
Court Location: Charlevoix County
Allow One-Time: ✓
Allow Recurring: ✓
Cal.com Event Slug (One-Time): instant-35-single
Cal.com Event Slug (Recurring): instant-35-recurring
Icon: Instant Test
Is Active: ✓
```

**Example: Lab 11-Panel**
```
Name: Lab 11-Panel
Description: For Other Courts
Price: 40
Panel Count: 11
Court Location: Other Courts
Allow One-Time: ✓
Allow Recurring: ✓
Cal.com Event Slug (One-Time): lab-40-single
Cal.com Event Slug (Recurring): lab-40-recurring
Icon: Lab Test
Is Active: ✓
```

## User Flow

### Booking an Appointment

1. Client logs into dashboard
2. Navigates to "My Appointments"
3. Clicks "New Appointment"
4. **Step 1**: Selects "One-Time" or "Recurring"
5. **Step 2**: Selects test type (Instant $35 or Lab $40)
6. **Step 3**: Books via embedded Cal.com calendar
   - User data (name, email, phone) pre-filled
   - Selects date and time
   - Completes booking

### Webhook Processing

1. Cal.com sends webhook to `/api/webhooks/calcom`
2. System extracts phone number (required)
3. Detects if recurring based on Cal.com metadata
4. Creates booking in Payload
5. `setClientRelationship` hook links booking to client by email
6. `syncPhoneWithClient` hook:
   - Compares booking phone with client phone
   - Updates client phone if different
   - Adds old phone to history

### Cancelling an Appointment

1. Client clicks "Cancel" on appointment card
2. Dialog prompts for cancellation reason
3. System calls `/api/bookings/cancel`
4. API cancels on Cal.com (for recurring, cancels entire series)
5. Updates local booking status to 'cancelled'
6. Page refreshes to show updated status

### Rescheduling an Appointment

**Note**: Only available for one-time appointments

1. Client clicks "Reschedule" on appointment card
2. Dialog opens with embedded Cal.com reschedule interface
3. Client selects new date/time
4. Cal.com processes reschedule
5. Webhook updates booking with new times
6. Page refreshes automatically

## API Limitations

### Cal.com Reschedule API

- **Single appointments**: Can be rescheduled via API or embed
- **Recurring appointments**: Cannot be rescheduled via API (Cal.com limitation)
  - Can only cancel entire series
  - Individual occurrences cannot be rescheduled

### Workarounds

For recurring appointments, clients must:
1. Cancel the current recurring series
2. Create a new recurring series with desired schedule

## Data Migration

If you have existing data in the legacy `recurringAppointments` fields:

1. **Before deploying**: Export client data with recurring appointment info
2. **After deploying**:
   - Review `Appointments` collection for any active recurring appointments
   - Migrate to Cal.com recurring bookings if needed
   - The `appointments` join field is still available for backwards compatibility

## Testing

Run tests:
```bash
pnpm test src/lib/__tests__/calcom.test.ts
```

Test coverage:
- Phone extraction from webhooks
- Recurring booking detection
- Phone number normalization and matching

## Future Enhancements

1. **Stripe Integration for Recurring**
   - Currently recurring appointments use Cal.com's built-in payment
   - Could integrate Stripe subscriptions for advanced billing

2. **Individual Recurrence Management**
   - Allow skipping individual occurrences
   - Reschedule single occurrence in series

3. **Appointment Reminders**
   - Email/SMS reminders before appointments
   - Use Cal.com webhook events: `MEETING_STARTED`, `MEETING_ENDED`

4. **Analytics Dashboard**
   - Track booking trends
   - Popular test types and time slots
   - Cancellation/reschedule rates

## Troubleshooting

### Phone number not syncing

- Check webhook logs in Payload admin
- Verify phone field is configured in Cal.com event type
- Ensure webhook is sending `responses.phone.value`

### Cancellation not working

- Verify `CALCOM_API_KEY` is set correctly
- Check API key has appropriate permissions in Cal.com
- Review logs in `/api/bookings/cancel`

### Recurring detection failing

- Check webhook payload structure
- Verify Cal.com is sending `recurringEventId`
- May need to update `detectRecurringBooking()` logic

## Support

For issues or questions:
1. Check webhook logs in Payload admin
2. Review Cal.com API documentation: https://cal.com/docs/api-reference
3. Check browser console for client-side errors

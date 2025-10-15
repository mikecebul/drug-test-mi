# Development Testing Guide

## Testing Cal.com Webhooks Locally

Since Cal.com webhooks require a public URL, testing in development can be challenging. We've created tools to simulate webhook events locally.

### Method 1: UI Button (Easiest)

A "Test Webhook" button appears in development mode on the appointments page:

1. Navigate to `/dashboard/appointments`
2. Click the "Test Webhook" button (bug icon)
3. Fill in the form:
   - **Event Type**: BOOKING_CREATED, BOOKING_CANCELLED, or BOOKING_RESCHEDULED
   - **Name**: Client name
   - **Email**: Client email (must match existing client)
   - **Phone**: Phone number
   - **Test Type**: instant or lab
   - **Recurring**: Check for recurring appointment
4. Click "Send Test Webhook"

The button will:
- Create a mock Cal.com webhook payload
- Send it to `/api/webhooks/calcom`
- Process it just like a real webhook
- Show success/error toast

### Method 2: API Endpoint

#### Test via Browser (GET)

Visit `http://localhost:3000/api/test-calcom-webhook` to see API documentation and examples.

#### Test via cURL (POST)

**Basic one-time booking:**
```bash
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "phone": "(231) 555-1234"
  }'
```

**Recurring booking:**
```bash
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "phone": "(231) 555-1234",
    "isRecurring": true,
    "testType": "lab"
  }'
```

**Cancel booking:**
```bash
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "triggerEvent": "BOOKING_CANCELLED",
    "email": "test@example.com",
    "name": "Test User",
    "phone": "(231) 555-1234"
  }'
```

### Method 3: Postman/Insomnia

**Endpoint:** `POST http://localhost:3000/api/test-calcom-webhook`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "triggerEvent": "BOOKING_CREATED",
  "email": "john@example.com",
  "name": "John Doe",
  "phone": "(231) 555-0100",
  "isRecurring": false,
  "testType": "instant"
}
```

## What Gets Created

When you send a test webhook:

1. **Booking Record** is created in Payload
   - `phone` is extracted and normalized
   - `isRecurring` flag is set based on payload
   - `recurringGroupId` is set for recurring bookings
   - `testType` is set to instant/lab

2. **Client Relationship** is established
   - Finds or creates client by email
   - Syncs phone number with client
   - Updates phone history if number changed

3. **Payload Hooks** are triggered
   - `setClientRelationship` - Links booking to client
   - `syncClient` - Updates client booking counts
   - `syncPhoneWithClient` - Syncs phone number

## Verifying Results

### Check Bookings
1. Go to Payload Admin → Bookings
2. Look for the test booking with `createdViaWebhook: true`
3. Verify `relatedClient` is linked
4. Check `phone`, `isRecurring`, `recurringGroupId` fields

### Check Client
1. Go to Payload Admin → Clients
2. Find the client by email
3. Check their `phone` field is updated
4. Check `phoneHistory` if phone changed
5. Verify `totalBookings` count increased
6. Check the "Bookings" join tab

### Check Dashboard
1. Log in as the test client
2. Go to "My Appointments"
3. Verify booking appears in Upcoming
4. Check recurring badge if applicable
5. Test cancel/reschedule actions

## Troubleshooting

### "Phone number is required for bookings"

The test endpoint includes a phone by default. If you're getting this error:
- Check the webhook handler is extracting phone from `payload.responses.phone.value`
- Verify the mock payload structure in `/api/test-calcom-webhook/route.ts`

### Client not linked to booking

- Ensure a client exists with the test email
- Check `setClientRelationship` hook is running
- Look for errors in the terminal logs

### Phone not syncing

- Check `syncPhoneWithClient` hook is in the Bookings collection
- Verify `phoneNumbersMatch()` utility is working correctly
- Look for errors in terminal logs

### Test button not showing

- Verify `NODE_ENV=development`
- Check `TestWebhookButton` component is imported
- Clear Next.js cache: `rm -rf .next && pnpm dev`

## Production Considerations

- The test webhook endpoint is **disabled in production**
- The test webhook button **does not render in production**
- Webhook signature verification is **enabled in production**
- Set `CALCOM_WEBHOOK_SECRET` in production environment

## Testing Real Cal.com Webhooks

To test with actual Cal.com webhooks in development:

1. **Use ngrok or similar**:
   ```bash
   ngrok http 3000
   ```

2. **Configure Cal.com webhook**:
   - URL: `https://your-ngrok-url.ngrok.io/api/webhooks/calcom`
   - Events: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
   - Secret: Your `CALCOM_WEBHOOK_SECRET`

3. **Make a real booking** in Cal.com

4. **Check ngrok logs** to see webhook requests

## Common Test Scenarios

### Scenario 1: New Client Booking
```bash
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newclient@example.com",
    "name": "New Client",
    "phone": "(231) 555-9999"
  }'
```
Expected: New client created, booking linked

### Scenario 2: Existing Client Updates Phone
```bash
# First booking
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "name": "John", "phone": "(231) 555-0001"}'

# Second booking with different phone
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "name": "John", "phone": "(231) 555-0002"}'
```
Expected: Client phone updated, old phone in history

### Scenario 3: Recurring Appointment Series
```bash
curl -X POST http://localhost:3000/api/test-calcom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recurring@example.com",
    "name": "Recurring Client",
    "phone": "(231) 555-7777",
    "isRecurring": true,
    "testType": "lab"
  }'
```
Expected: Booking with `isRecurring: true`, `recurringGroupId` set

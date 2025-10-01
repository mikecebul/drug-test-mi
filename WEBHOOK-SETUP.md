# Stripe Webhook Setup Guide

## Problem
Enrollments are being created but:
- ❌ Customer field is empty (should link to client)
- ❌ Status is "pending" (should be "processing")
- ❌ No transaction created

This happens because the webhook isn't configured yet.

## Solution: Configure Stripe Webhooks

### Option 1: Local Development (Using Stripe CLI)

1. **Install Stripe CLI** (if not already installed):
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server**:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Copy the webhook signing secret** that appears (starts with `whsec_...`)

5. **Add to your `.env.local`**:
   ```bash
   STRIPE_WEBHOOKS_SIGNING_SECRET=whsec_xxxxxxxxxxxxx
   ```

6. **Restart your dev server**

7. **Test an enrollment** - you should see webhook events in the terminal where `stripe listen` is running

### Option 2: Production/Staging

1. **Go to Stripe Dashboard**:
   - Navigate to: Developers → Webhooks
   - Click "Add endpoint"

2. **Configure the endpoint**:
   - **Endpoint URL**: `https://your-domain.com/api/webhooks/stripe`
   - **Description**: "Subscription enrollment webhooks"

3. **Select events to listen for**:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

4. **Add endpoint** and **copy the signing secret**

5. **Add to your production environment variables**:
   ```bash
   STRIPE_WEBHOOKS_SIGNING_SECRET=whsec_xxxxxxxxxxxxx
   ```

## Verify Webhook is Working

After setup, test an enrollment and check:

### In Stripe Dashboard:
- Go to: Developers → Webhooks → [Your endpoint]
- Check the "Recent deliveries" tab
- You should see successful webhook deliveries

### In Your Server Logs:
Look for these log messages:
```
🪝 Processing subscription checkout completed for session: cs_xxxxx
Session metadata: { clientId: '...', productId: '...', ... }
Retrieved subscription: sub_xxxxx
Creating enrollment for client: xxx, product: yyy
✅ Created enrollment xxx for subscription sub_yyy
```

### In Your Database:
The enrollment should now have:
- ✅ **Customer**: Linked to the client who enrolled
- ✅ **Status**: "processing" (not "pending")
- ✅ **Subscription ID**: Stripe subscription ID
- ✅ **Transaction**: Created when first invoice is paid

## Troubleshooting

### Webhook returns 401/403
- Check that `STRIPE_WEBHOOKS_SIGNING_SECRET` is set correctly
- Make sure it matches the secret from Stripe Dashboard

### Webhook not being called
- Verify the endpoint URL is correct and publicly accessible
- Check that all 5 events are selected in Stripe Dashboard
- For local dev, make sure `stripe listen` is running

### Enrollment created but no customer
- Check server logs for errors in webhook handler
- Verify metadata is being passed correctly in checkout session
- The webhook might not be configured yet (most common issue)

### Transaction not created
- Transactions are created on `invoice.payment_succeeded` event
- This fires AFTER the subscription is created
- Check Stripe Dashboard → Webhooks for this event delivery

## Current Status

Your webhook endpoint is ready at: `/api/webhooks/stripe`

**Next step**: Follow Option 1 (local dev) or Option 2 (production) above to configure the webhook in Stripe.

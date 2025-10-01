# Recurring Payments Implementation Plan
## Using PayloadCMS Ecommerce Plugin + Custom Stripe Checkout Subscriptions

**Status:** ✅ Complete
**Started:** 2025-09-30
**Completed:** 2025-09-30
**Timeline:** 1 day (completed ahead of schedule)

---

## Overview

Implement Stripe Subscriptions for recurring drug testing appointments with automated technician scheduling and notifications. We're leveraging the PayloadCMS ecommerce plugin for data structure (products, orders/enrollments, transactions) and building a custom Stripe Checkout Subscription payment adapter.

---

## Phase 1: Install & Configure Ecommerce Plugin (Day 1)

### 1.1 Install Plugin
```bash
pnpm add @payloadcms/plugin-ecommerce
```

### 1.2 Configure Plugin in payload.config.ts
```typescript
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { USD } from '@payloadcms/plugin-ecommerce/currencies'
import { stripeCheckoutSubscriptionAdapter } from './plugins/stripe/checkoutSubscriptionAdapter'

plugins: [
  // ... existing plugins
  ecommercePlugin({
    // Access control
    access: {
      adminOnly,
      adminOnlyFieldAccess,
      adminOrCustomerOwner,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
    },

    // Use existing Clients collection as customers
    customers: {
      slug: 'clients'
    },

    // Currency config
    currencies: {
      supportedCurrencies: [USD],
      defaultCurrency: 'USD',
    },

    // Skip variants - not needed
    products: {
      variants: false,
    },

    // Skip carts - direct checkout
    carts: false,

    // Skip addresses - not needed for drug testing
    addresses: false,

    // Custom subscription payment adapter
    payments: {
      paymentMethods: [
        stripeCheckoutSubscriptionAdapter({
          secretKey: process.env.STRIPE_SECRET_KEY!,
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET!,
        }),
      ],
    },

    // Extend orders to be "Enrollments"
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        slug: 'enrollments',
        labels: {
          singular: 'Enrollment',
          plural: 'Enrollments',
        },
        fields: [
          ...defaultCollection.fields,
          // Subscription-specific fields
          {
            name: 'stripeSubscriptionId',
            type: 'text',
            admin: {
              readOnly: true,
              description: 'Stripe subscription ID',
            },
          },
          {
            name: 'subscriptionStatus',
            type: 'select',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Past Due', value: 'past_due' },
              { label: 'Canceled', value: 'canceled' },
              { label: 'Paused', value: 'paused' },
            ],
            admin: {
              readOnly: true,
            },
          },
          {
            name: 'testingType',
            type: 'select',
            required: true,
            options: [
              { label: 'Fixed Saturday 11:10am', value: 'fixed-saturday' },
              { label: 'Random 1x/week', value: 'random-1x' },
              { label: 'Random 2x/week', value: 'random-2x' },
            ],
          },
          {
            name: 'preferredDayOfWeek',
            type: 'select',
            options: [
              { label: 'Monday', value: 'monday' },
              { label: 'Tuesday', value: 'tuesday' },
              { label: 'Wednesday', value: 'wednesday' },
              { label: 'Thursday', value: 'thursday' },
              { label: 'Friday', value: 'friday' },
              { label: 'Saturday', value: 'saturday' },
              { label: 'Sunday', value: 'sunday' },
            ],
            admin: {
              condition: (data) => data?.testingType !== 'fixed-saturday',
            },
          },
          {
            name: 'preferredTimeSlot',
            type: 'select',
            options: [
              { label: 'Morning (8AM-12PM)', value: 'morning' },
              { label: 'Afternoon (12PM-5PM)', value: 'afternoon' },
              { label: 'Late Morning (10AM-12PM)', value: 'late-morning' },
            ],
            admin: {
              condition: (data) => data?.testingType !== 'fixed-saturday',
            },
          },
          {
            name: 'nextTestDate',
            type: 'date',
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
          {
            name: 'redwoodLabsId',
            type: 'text',
            admin: {
              description: 'External Redwood Labs ID',
            },
          },
        ],
      }),
    },

    // Extend transactions to track subscription data
    transactions: {
      transactionsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        fields: [
          ...defaultCollection.fields,
          {
            name: 'subscriptionPeriod',
            type: 'group',
            fields: [
              {
                name: 'periodStart',
                type: 'date',
              },
              {
                name: 'periodEnd',
                type: 'date',
              },
            ],
          },
        ],
      }),
    },
  }),
]
```

---

## Phase 2: Custom Stripe Checkout Subscription Adapter (Day 1-2)

### 2.1 Create Payment Adapter
**File:** `src/plugins/stripe/checkoutSubscriptionAdapter.ts`

```typescript
import { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'
import Stripe from 'stripe'

export const stripeCheckoutSubscriptionAdapter = (config: {
  secretKey: string
  publishableKey: string
  webhookSecret: string
}): PaymentAdapter => {
  const stripe = new Stripe(config.secretKey, { apiVersion: '2024-12-18.acacia' })

  return {
    name: 'stripe-checkout-subscription',
    label: 'Stripe Checkout (Subscription)',

    // Create Stripe Checkout Session for subscription
    initiatePayment: async ({ data, transactionsSlug, req }) => {
      const { cart, customerEmail } = data
      const payload = req.payload

      // Get or create Stripe customer
      let stripeCustomer = await getOrCreateStripeCustomer(
        stripe,
        customerEmail,
        req.user?.id
      )

      // Create Checkout Session in subscription mode
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomer.id,
        line_items: cart.items.map(item => ({
          price: item.product.stripePriceId, // Store on product
          quantity: item.quantity,
        })),
        success_url: `${baseUrl}/enrollment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/enrollment/cancel`,
        metadata: {
          cartId: cart.id,
          customerId: req.user?.id || '',
          transactionId: 'pending', // Updated in webhook
        },
      })

      // Create transaction record (pending)
      await payload.create({
        collection: transactionsSlug,
        data: {
          status: 'processing',
          amount: session.amount_total,
          cart: cart.id,
          customer: req.user?.id,
          paymentMethod: 'stripe-checkout-subscription',
          'stripe-checkout-subscription': {
            sessionId: session.id,
            customerId: stripeCustomer.id,
          },
        },
      })

      return {
        message: 'Checkout session created',
        checkoutUrl: session.url, // Redirect user here
      }
    },

    // Confirm order (called from webhook after payment)
    confirmOrder: async ({ data, ordersSlug, req }) => {
      const { subscriptionId, sessionId } = data
      const payload = req.payload

      // Retrieve subscription details
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      // Create enrollment (order)
      const order = await payload.create({
        collection: ordersSlug,
        data: {
          customer: session.metadata.customerId,
          customerEmail: session.customer_email,
          items: session.metadata.cartItems, // Passed from session
          amount: subscription.items.data[0].plan.amount,
          currency: subscription.currency,
          status: 'processing',
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          testingType: session.metadata.testingType,
          preferredDayOfWeek: session.metadata.preferredDayOfWeek,
          preferredTimeSlot: session.metadata.preferredTimeSlot,
        },
      })

      return {
        message: 'Enrollment created',
        orderID: order.id,
      }
    },

    // Custom group for storing subscription data on transactions
    group: {
      name: 'stripe-checkout-subscription',
      type: 'group',
      fields: [
        { name: 'sessionId', type: 'text', label: 'Checkout Session ID' },
        { name: 'customerId', type: 'text', label: 'Stripe Customer ID' },
        { name: 'subscriptionId', type: 'text', label: 'Subscription ID' },
      ],
    },
  }
}
```

### 2.2 Stripe Webhook Handlers
**File:** `src/plugins/stripe/webhooks/subscriptionHandlers.ts`

Handle these events:
- `checkout.session.completed` → Create enrollment
- `customer.subscription.updated` → Update enrollment status
- `customer.subscription.deleted` → Cancel enrollment
- `invoice.payment_succeeded` → Create transaction record
- `invoice.payment_failed` → Update enrollment status to past_due

Update `payload.config.ts` to register webhooks with stripePlugin.

---

## Phase 3: Products Collection (Day 2)

### 3.1 Create Subscription Products
The plugin creates the products collection automatically. Add products via admin:

**Example Products:**
1. Weekly Random Testing - $50/week
2. Bi-Weekly Random Testing - $90/2 weeks
3. Saturday Fixed Testing - $200/month

**Required fields on each product:**
- `stripePriceId` (custom field) - Add via productsCollectionOverride
- `testingFrequency` (custom field)
- Price in USD
- Description

### 3.2 Override Products Collection
```typescript
products: {
  variants: false,
  productsCollectionOverride: ({ defaultCollection }) => ({
    ...defaultCollection,
    fields: [
      ...defaultCollection.fields,
      {
        name: 'stripePriceId',
        type: 'text',
        required: true,
        admin: {
          description: 'Stripe Price ID (price_xxxxx) for subscription',
        },
      },
      {
        name: 'testingFrequency',
        type: 'select',
        options: [
          { label: 'Weekly', value: 'weekly' },
          { label: 'Bi-Weekly', value: 'biweekly' },
          { label: 'Monthly', value: 'monthly' },
        ],
      },
    ],
  }),
}
```

---

## Phase 4: Technician Scheduling System (Day 3)

### 4.1 Enhance Technicians Collection
**File:** `src/collections/Technicians/index.ts`

Add fields:
```typescript
{
  name: 'email',
  type: 'email',
  required: true,
},
{
  name: 'phone',
  type: 'text',
},
{
  name: 'regularSchedule',
  type: 'array',
  fields: [
    {
      name: 'dayOfWeek',
      type: 'select',
      options: ['monday', 'tuesday', ...],
      required: true,
    },
    {
      name: 'timeSlot',
      type: 'select',
      options: [
        { label: 'Morning (8AM-12PM)', value: 'morning' },
        { label: 'Afternoon (12PM-5PM)', value: 'afternoon' },
        { label: 'Late Morning (10AM-12PM)', value: 'late-morning' },
      ],
      required: true,
    },
    {
      name: 'startTime',
      type: 'text',
      required: true,
    },
    {
      name: 'endTime',
      type: 'text',
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
```

### 4.2 Create ScheduleOverrides Collection
**File:** `src/collections/ScheduleOverrides/index.ts`

For handling swaps/coverage:
```typescript
export const ScheduleOverrides: CollectionConfig = {
  slug: 'schedule-overrides',
  admin: {
    useAsTitle: 'date',
    group: 'Scheduling',
  },
  fields: [
    { name: 'date', type: 'date', required: true },
    { name: 'timeSlot', type: 'select', options: [...], required: true },
    { name: 'originalTechnician', type: 'relationship', relationTo: 'technicians' },
    { name: 'coveringTechnician', type: 'relationship', relationTo: 'technicians' },
    { name: 'reason', type: 'select', options: ['swap', 'coverage', 'vacation'] },
    { name: 'notes', type: 'textarea' },
  ],
}
```

### 4.3 Technician Finder Utility
**File:** `src/lib/findTechnicianOnDuty.ts`

```typescript
export async function findTechnicianOnDuty(
  date: Date,
  time: string,
  payload: Payload
) {
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'lowercase' })
  const timeSlot = determineTimeSlot(time, dayOfWeek)

  // 1. Check for overrides first
  const override = await payload.find({
    collection: 'schedule-overrides',
    where: {
      and: [
        { date: { equals: date.toISOString().split('T')[0] } },
        { timeSlot: { equals: timeSlot } }
      ]
    },
    limit: 1,
  })

  if (override.docs[0]) {
    return override.docs[0].coveringTechnician
  }

  // 2. Fall back to regular schedule
  const technician = await payload.find({
    collection: 'technicians',
    where: {
      and: [
        { active: { equals: true } },
        { 'regularSchedule.dayOfWeek': { equals: dayOfWeek } },
        { 'regularSchedule.timeSlot': { equals: timeSlot } },
        { 'regularSchedule.isActive': { equals: true } }
      ]
    },
    limit: 1,
  })

  return technician.docs[0]
}
```

### 4.4 Enhance DrugTests Collection
**File:** `src/collections/DrugTests/index.ts`

Add fields:
```typescript
{
  name: 'enrollment',
  type: 'relationship',
  relationTo: 'enrollments',
  admin: {
    description: 'Related subscription enrollment',
  },
},
{
  name: 'technician',
  type: 'relationship',
  relationTo: 'technicians',
  admin: {
    description: 'Auto-assigned technician',
  },
},
{
  name: 'notifiedTechnician',
  type: 'relationship',
  relationTo: 'technicians',
  admin: {
    readOnly: true,
    description: 'Technician who was notified',
  },
}
```

Add hooks:
```typescript
hooks: {
  beforeChange: [
    // Auto-assign technician
    async ({ data, operation, req }) => {
      if (operation === 'create' && !data.technician) {
        const tech = await findTechnicianOnDuty(
          new Date(data.collectionDate),
          data.collectionTime,
          req.payload
        )
        if (tech) data.technician = tech.id
      }
      return data
    }
  ],
  afterChange: [
    // Notify technician
    async ({ doc, operation, previousDoc, req }) => {
      const shouldNotify = operation === 'create' ||
        (previousDoc && (
          doc.collectionDate !== previousDoc.collectionDate ||
          doc.collectionTime !== previousDoc.collectionTime
        ))

      if (shouldNotify && doc.technician) {
        await notifyTechnician(doc, req.payload)
        await req.payload.update({
          collection: 'drug-tests',
          id: doc.id,
          data: { notifiedTechnician: doc.technician }
        })
      }
    }
  ]
}
```

---

## Phase 5: Frontend - Enrollment Flow (Day 4)

### 5.1 Enrollment Page
**File:** `src/app/(frontend)/enroll/page.tsx`

1. Display available products
2. User selects plan + preferences (day, time, testing type)
3. Call server action to initiate payment
4. Redirect to Stripe Checkout
5. Handle success/cancel callbacks

### 5.2 Server Action
**File:** `src/actions/enrollment.ts`

```typescript
'use server'

export async function initiateEnrollment(data: {
  productId: string
  testingType: string
  preferredDay?: string
  preferredTimeSlot?: string
}) {
  const payload = await getPayload({ config })

  // Call adapter's initiatePayment
  const result = await payload.payments['stripe-checkout-subscription'].initiatePayment({
    data: {
      ...data,
      customerEmail: user.email,
    },
    req,
  })

  return result.checkoutUrl
}
```

### 5.3 Success Page
**File:** `src/app/(frontend)/enrollment/success/page.tsx`

Confirm enrollment was created, show next steps.

---

## Phase 6: Client Dashboard - Manage Subscription (Day 5)

**File:** `src/app/dashboard/subscription/page.tsx`

Features:
- View current enrollment
- See subscription status
- Update payment method (Stripe Customer Portal)
- Pause/cancel subscription
- View upcoming tests

---

## Summary

### What We're Using from the Plugin:
✅ **Products** - Subscription plans
✅ **Orders** (as Enrollments) - With custom subscription fields
✅ **Transactions** - Payment records
✅ **Payment adapter pattern** - Custom Stripe Checkout Subscription adapter
❌ Carts - Not needed
❌ Variants - Not needed
❌ Addresses - Not needed

### What We're Building Custom:
- Stripe Checkout Subscription payment adapter
- Subscription webhook handlers
- Technician scheduling system (ScheduleOverrides, regularSchedule)
- Auto-assignment logic for drug tests
- Technician notification system

### Files to Create/Modify

#### New Files Created:
1. ✅ `src/plugins/stripe/checkoutSubscriptionAdapter.ts` - Custom Stripe subscription adapter
2. ✅ `src/plugins/stripe/webhooks/subscriptionHandlers.ts` - Webhook event handlers
3. ✅ `src/collections/ScheduleOverrides/index.ts` - Schedule override collection
4. ✅ `src/lib/findTechnicianOnDuty.ts` - Technician assignment utility
5. ✅ `src/collections/DrugTests/hooks/autoAssignTechnician.ts` - Auto-assignment hook
6. ✅ `src/collections/DrugTests/hooks/notifyTechnician.ts` - Notification hook
7. ✅ `src/app/(frontend)/enroll/page.tsx` - Enrollment page
8. ✅ `src/app/(frontend)/enroll/EnrollmentForm.tsx` - Enrollment form component
9. ✅ `src/app/(frontend)/enroll/actions.ts` - Enrollment server actions
10. ✅ `src/app/(frontend)/enroll/success/page.tsx` - Success callback page
11. ✅ `src/app/(frontend)/enroll/cancel/page.tsx` - Cancel callback page
12. ✅ `src/app/dashboard/subscription/page.tsx` - Subscription dashboard page
13. ✅ `src/app/dashboard/subscription/SubscriptionView.tsx` - Subscription view component
14. ✅ `src/app/dashboard/subscription/actions.ts` - Subscription management actions

#### Modified Files:
1. ✅ `src/payload.config.ts` - Added ecommerce plugin with full configuration
2. ✅ `src/collections/Technicians/index.ts` - Added email, phone, regularSchedule fields
3. ✅ `src/collections/DrugTests/index.ts` - Added enrollment, technician, collectionTime fields + hooks
4. ✅ `.gitignore` - Added *.tsbuildinfo pattern

### Environment Variables

Add to `.env`:
```bash
STRIPE_SECRET_KEY=sk_...  # Already exists
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...  # Add if not present
STRIPE_WEBHOOKS_SIGNING_SECRET=whsec_...  # Update for subscription events
```

### Timeline:
- ✅ **Phase 1 (Day 1)**: Plugin setup + Products configuration
- ✅ **Phase 2 (Day 1)**: Custom payment adapter + webhooks
- ✅ **Phase 3 (Day 1)**: Products collection override
- ✅ **Phase 4 (Day 1)**: Technician scheduling system
- ✅ **Phase 5 (Day 1)**: Frontend enrollment flow
- ✅ **Phase 6 (Day 1)**: Client dashboard + subscription management

**Total: 1 day** (originally planned for 5 days)

---

## Testing Checklist

### ⏳ Next Steps - Testing & Configuration:

#### Stripe Configuration:
- [ ] Create subscription products in Stripe dashboard
- [ ] Add Stripe Price IDs to products in PayloadCMS admin
- [ ] Configure webhook endpoint in Stripe for subscription events
- [ ] Test webhook locally using Stripe CLI

#### Subscription Flow:
- [ ] Can create subscription via Stripe Checkout
- [ ] Webhook creates enrollment on successful payment
- [ ] Subscription status syncs correctly
- [ ] Monthly renewals create transaction records
- [ ] Failed payments update enrollment status

#### Technician Scheduling:
- [ ] Add technician regular schedules in admin
- [ ] Technicians auto-assigned to drug tests
- [ ] Schedule overrides work correctly
- [ ] Notifications sent to correct technician
- [ ] Can view technician schedules in admin

#### Client Dashboard:
- [ ] View active enrollment
- [ ] Update payment method via Stripe Customer Portal
- [ ] Cancel subscription
- [ ] View upcoming tests
- [ ] Prevent duplicate enrollments

---

## Implementation Summary

### ✅ Completed Features:

#### Backend Infrastructure:
- **Ecommerce Plugin Integration**: Full PayloadCMS ecommerce plugin setup with custom configuration
- **Custom Payment Adapter**: Stripe Checkout subscription adapter with session management
- **Webhook Handlers**: Complete subscription lifecycle event handling (created, updated, deleted, payments)
- **Collections Enhanced**:
  - Products with `stripePriceId` and `testingFrequency` fields
  - Orders (as Enrollments) with subscription-specific fields
  - Transactions with subscription period tracking
  - Technicians with email, phone, and regular schedule arrays
  - DrugTests with enrollment, technician, and notification tracking
- **New Collections**:
  - ScheduleOverrides for technician schedule management

#### Automation:
- **Auto-assignment**: Drug tests automatically assigned to on-duty technician
- **Notifications**: Email notifications sent to technicians when assigned
- **Schedule Intelligence**: Finds technician by checking overrides first, then regular schedule

#### Frontend:
- **Enrollment Flow**: Complete product selection → preferences → Stripe Checkout
- **Success/Cancel Pages**: Post-checkout user experience
- **Dashboard Integration**: Full subscription management UI

### Architecture Decisions:

- ✅ Using Stripe Checkout in `subscription` mode instead of one-time payments
- ✅ Skipping cart functionality - direct checkout for simplicity
- ✅ Orders collection renamed to "Enrollments" for clarity in UI
- ✅ Technician scheduling is automated but manually overrideable via ScheduleOverrides
- ✅ All subscription state synced via Stripe webhooks
- ✅ Customer records use existing Clients collection (ecommerce customers)
- ✅ Products, Orders, and Transactions managed by ecommerce plugin
- ✅ Direct enrollment action (bypasses cart creation) for better UX

### Key Technical Patterns:

1. **Server Components First**: Dashboard pages use Next.js server components with `force-dynamic`
2. **Auth Consistency**: Reusing `requireClientAuth()` utility throughout
3. **Type Safety**: TypeScript types auto-generated from Payload schema
4. **Webhook-Driven**: Subscription state changes trigger database updates
5. **Stripe Customer Portal**: Payment method updates handled by Stripe's hosted UI

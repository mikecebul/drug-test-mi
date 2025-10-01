# Simplified Recurring Payments Plan
## Direct Stripe Integration (No Ecommerce Plugin)

**Status:** Planning
**Approach:** Stripe Subscriptions + Custom PayloadCMS Collections

---

## Why This Approach?

✅ **Simpler** - No unnecessary ecommerce fields (carts, variants, inventory, etc.)
✅ **Cleaner** - Only the fields we actually need
✅ **Direct** - Straight to Stripe Checkout, no adapter complexity
✅ **Full Control** - Custom collections tailored to drug testing business

---

## Architecture Overview

```
User → Subscription Plan Page → Stripe Checkout → Webhook → Enrollment Created
```

**Key Components:**
1. **Custom Collections** - Simple, focused collections for our needs
2. **Stripe Checkout** - Direct integration for subscriptions
3. **Webhooks** - Handle all subscription lifecycle events
4. **Client Dashboard** - Manage subscription via Stripe Customer Portal

---

## Phase 1: Collections (Day 1)

### 1.1 Products Collection
Simple subscription plans - no ecommerce complexity.

```typescript
// src/collections/Products/index.ts
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    group: 'Subscriptions',
  },
  access: {
    read: () => true,
    create: admins,
    update: admins,
    delete: superAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'stripePriceId',
      type: 'text',
      required: true,
      admin: {
        description: 'Stripe Price ID (price_xxxxx)',
      },
    },
    {
      name: 'priceAmount',
      type: 'number',
      required: true,
      admin: {
        description: 'Price in cents (e.g., 5000 = $50.00)',
      },
    },
    {
      name: 'interval',
      type: 'select',
      required: true,
      options: [
        { label: 'Weekly', value: 'week' },
        { label: 'Monthly', value: 'month' },
      ],
    },
    {
      name: 'testingFrequency',
      type: 'select',
      required: true,
      options: [
        { label: 'Weekly', value: 'weekly' },
        { label: 'Bi-Weekly', value: 'biweekly' },
        { label: 'Monthly', value: 'monthly' },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
```

### 1.2 Enrollments Collection
Replaces "Orders" - focused on subscriptions.

```typescript
// src/collections/Enrollments/index.ts
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    useAsTitle: 'id',
    group: 'Subscriptions',
    defaultColumns: ['client', 'product', 'status', 'createdAt'],
  },
  access: {
    create: admins,
    read: ({ req }) => {
      if (req.user?.collection === 'admins') return true
      if (req.user?.collection === 'clients') {
        return { client: { equals: req.user.id } }
      }
      return false
    },
    update: admins,
    delete: superAdmin,
  },
  fields: [
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      hasMany: false,
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      unique: true,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Incomplete', value: 'incomplete' },
      ],
      defaultValue: 'incomplete',
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
      name: 'preferredDay',
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
      ],
      admin: {
        condition: (data) => data?.testingType !== 'fixed-saturday',
      },
    },
    {
      name: 'currentPeriodStart',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'cancelAtPeriodEnd',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
      },
    },
  ],
}
```

### 1.3 Update Clients Collection
Add minimal subscription fields.

```typescript
// Add to existing Clients collection
{
  name: 'stripeCustomerId',
  type: 'text',
  admin: {
    readOnly: true,
    position: 'sidebar',
  },
},
```

### 1.4 Keep Existing Collections
- ✅ **DrugTests** - Already has enrollment field ready
- ✅ **Technicians** - Already enhanced with scheduling
- ✅ **ScheduleOverrides** - Already created

---

## Phase 2: Enrollment Flow (Day 2)

### 2.1 Products Page
Display available subscription plans.

```typescript
// src/app/dashboard/enroll/page.tsx
export default async function EnrollPage() {
  const client = await requireClientAuth()
  const payload = await getPayload({ config })

  // Check for existing active enrollment
  const existingEnrollments = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { client: { equals: client.id } },
        { status: { in: ['active', 'past_due'] } },
      ],
    },
    limit: 1,
  })

  if (existingEnrollments.docs.length > 0) {
    redirect('/dashboard/subscription')
  }

  // Get active products
  const products = await payload.find({
    collection: 'products',
    where: { isActive: { equals: true } },
  })

  return <EnrollmentForm products={products.docs} client={client} />
}
```

### 2.2 Enrollment Action
Create Stripe Checkout session.

```typescript
// src/app/dashboard/enroll/actions.ts
export async function createCheckoutSession(data: {
  productId: string
  testingType: string
  preferredDay?: string
  preferredTimeSlot?: string
}): Promise<string> {
  const client = await requireClientAuth()
  const payload = await getPayload({ config })

  // Get product
  const product = await payload.findByID({
    collection: 'products',
    id: data.productId,
  })

  // Get or create Stripe customer
  let stripeCustomerId = client.stripeCustomerId

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: client.email,
      name: `${client.firstName} ${client.lastName}`,
      metadata: { clientId: client.id },
    })
    stripeCustomerId = customer.id

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: { stripeCustomerId: customer.id },
    })
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: product.stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/enroll/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/enroll`,
    metadata: {
      clientId: client.id,
      productId: product.id,
      testingType: data.testingType,
      preferredDay: data.preferredDay || '',
      preferredTimeSlot: data.preferredTimeSlot || '',
    },
  })

  return session.url!
}
```

---

## Phase 3: Webhooks (Day 2-3)

### 3.1 Webhook Endpoint
Handle Stripe subscription events.

```typescript
// src/app/api/webhooks/stripe/route.ts
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  )

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event, payload)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event, payload)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event, payload)
      break
  }

  return NextResponse.json({ received: true })
}
```

### 3.2 Webhook Handlers

```typescript
// src/lib/stripe/webhookHandlers.ts

export async function handleCheckoutCompleted(
  event: Stripe.Event,
  payload: Payload
) {
  const session = event.data.object as Stripe.Checkout.Session
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  )

  // Create enrollment
  await payload.create({
    collection: 'enrollments',
    data: {
      client: session.metadata!.clientId,
      product: session.metadata!.productId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status as any,
      testingType: session.metadata!.testingType as any,
      preferredDay: session.metadata!.preferredDay || null,
      preferredTimeSlot: session.metadata!.preferredTimeSlot || null,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    },
  })
}

export async function handleSubscriptionUpdated(
  event: Stripe.Event,
  payload: Payload
) {
  const subscription = event.data.object as Stripe.Subscription

  const enrollments = await payload.find({
    collection: 'enrollments',
    where: { stripeSubscriptionId: { equals: subscription.id } },
    limit: 1,
  })

  if (enrollments.docs[0]) {
    await payload.update({
      collection: 'enrollments',
      id: enrollments.docs[0].id,
      data: {
        status: subscription.status as any,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      },
    })
  }
}

export async function handleSubscriptionDeleted(
  event: Stripe.Event,
  payload: Payload
) {
  const subscription = event.data.object as Stripe.Subscription

  const enrollments = await payload.find({
    collection: 'enrollments',
    where: { stripeSubscriptionId: { equals: subscription.id } },
    limit: 1,
  })

  if (enrollments.docs[0]) {
    await payload.update({
      collection: 'enrollments',
      id: enrollments.docs[0].id,
      data: { status: 'canceled' },
    })
  }
}
```

---

## Phase 4: Dashboard (Day 3)

### 4.1 Subscription Management Page

```typescript
// src/app/dashboard/subscription/page.tsx
export default async function SubscriptionPage() {
  const client = await requireClientAuth()
  const payload = await getPayload({ config })

  const enrollment = await payload.find({
    collection: 'enrollments',
    where: { client: { equals: client.id } },
    limit: 1,
    depth: 2,
  })

  if (!enrollment.docs[0]) {
    return <NoSubscriptionView />
  }

  return <SubscriptionView enrollment={enrollment.docs[0]} />
}
```

### 4.2 Subscription Actions

```typescript
// src/app/dashboard/subscription/actions.ts

export async function openCustomerPortal() {
  const client = await requireClientAuth()

  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripeCustomerId!,
    return_url: `${baseUrl}/dashboard/subscription`,
  })

  return session.url
}

export async function cancelSubscription(subscriptionId: string) {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}
```

---

## Phase 5: Drug Test Integration (Day 4)

### 5.1 Link DrugTests to Enrollments

Already done! The DrugTests collection already has:
- `enrollment` field
- `technician` field
- Auto-assignment hooks
- Notification system

### 5.2 Schedule Generator (Future)

Create a cron job or scheduled task to:
1. Check active enrollments
2. Generate upcoming drug tests based on frequency
3. Auto-assign technicians
4. Send notifications

---

## File Structure

```
src/
├── collections/
│   ├── Products/index.ts                    [NEW]
│   ├── Enrollments/index.ts                 [NEW]
│   ├── Clients/index.ts                     [UPDATE - add stripeCustomerId]
│   ├── DrugTests/                           [KEEP - already done]
│   ├── Technicians/                         [KEEP - already done]
│   └── ScheduleOverrides/                   [KEEP - already done]
├── app/
│   ├── api/webhooks/stripe/route.ts         [NEW]
│   └── dashboard/
│       ├── enroll/
│       │   ├── page.tsx                     [NEW]
│       │   ├── EnrollmentForm.tsx           [NEW]
│       │   ├── actions.ts                   [NEW]
│       │   ├── success/page.tsx             [NEW]
│       │   └── cancel/page.tsx              [NEW]
│       └── subscription/
│           ├── page.tsx                     [NEW]
│           ├── SubscriptionView.tsx         [NEW]
│           └── actions.ts                   [NEW]
└── lib/
    └── stripe/
        └── webhookHandlers.ts               [NEW]
```

---

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Stripe Dashboard Setup

### 1. Create Products & Prices
- Weekly Testing: $50/week
- Bi-Weekly Testing: $90/2 weeks
- Monthly Testing: $200/month

### 2. Configure Webhook
- Endpoint: `https://your-domain.com/api/webhooks/stripe`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

---

## Testing Checklist

- [ ] Can view available subscription plans
- [ ] Can select plan and preferences
- [ ] Redirects to Stripe Checkout correctly
- [ ] Webhook creates enrollment after payment
- [ ] Enrollment has correct client linked
- [ ] Enrollment has correct status
- [ ] Can view enrollment in dashboard
- [ ] Can manage payment method via Customer Portal
- [ ] Can cancel subscription
- [ ] Canceled subscription status updates correctly

---

## Benefits Over Ecommerce Plugin

✅ **90% less code** - No unused ecommerce features
✅ **Clean collections** - Only fields we need
✅ **Easy to understand** - Simple, direct flow
✅ **Easy to maintain** - No adapter complexity
✅ **Full control** - Custom business logic
✅ **Type-safe** - Payload generates clean types

---

## Timeline

- **Day 1**: Collections setup
- **Day 2**: Enrollment flow + webhooks
- **Day 3**: Dashboard + subscription management
- **Day 4**: Testing + refinement

**Total: 3-4 days** (vs 5+ days with ecommerce plugin complexity)

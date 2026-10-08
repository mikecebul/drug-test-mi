import { expect, test } from '@playwright/test'
import type Stripe from 'stripe'
import type { Admin } from '../../src/payload-types'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { cleanupFixtures } from './helpers/cleanup'
import { getPayloadClient } from './helpers/payload'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import {
  clickBack,
  clickNext,
  expectWizardStep,
  goToLabScreenData,
  selectWorkflow,
  selectResultDecision,
} from './helpers/wizard'
import { findMailpitMessages } from './helpers/mailpit'
import { prepareConfirmation } from '../../src/collections/DrugTests/confirmation/prepare'
import { sendConfirmationPaymentLink } from '../../src/collections/DrugTests/confirmation/paymentLink'
import { checkoutSessionCompleted } from '../../src/plugins/stripe/webhooks/checkoutSessionCompleted'
import { withPayloadTransaction } from '../../src/collections/Payments/services/withPayloadTransaction'
import { reversePostedPayments } from '../../src/collections/Payments/services/reversePayments'
import { previewReferralInvoice } from '../../src/lib/referral-invoices'
import { currentBillingMonth } from '../../src/lib/referral-invoices/date'
import { confirmationPaymentRequired } from '../../src/collections/DrugTests/confirmation/policy'
let fixtures: FixtureContext
let owner: Admin & { collection: 'admins' }
test.beforeEach(async () => {
  fixtures = await seedFixtures()
  const payload = await getPayloadClient()
  const bootstrap = {
    id: fixtures.admin.id,
    email: fixtures.admin.email,
    role: 'superAdmin',
    collection: 'admins',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as const
  const doc = await payload.create({
    collection: 'admins',
    overrideAccess: true,
    user: bootstrap,
    req: { headers: { 'X-Payload-Migration': 'true' } as unknown as Headers },
    data: {
      name: 'Confirmation Owner',
      role: 'superAdmin',
      email: `confirmation-owner.${fixtures.runId}@example.com`,
      password: 'StrongPass123!',
    },
  })
  fixtures.created.adminIds.push(doc.id)
  const stored = await payload.findByID({
    collection: 'admins',
    id: doc.id,
    depth: 0,
    user: bootstrap,
    overrideAccess: true,
  })
  expect(stored.role).toBe('superAdmin')
  owner = { ...stored, collection: 'admins' }
  await payload.update({
    collection: 'admins',
    id: fixtures.admin.id,
    overrideAccess: true,
    user: owner,
    req: { headers: { 'X-Payload-Migration': 'true' } as unknown as Headers },
    data: { role: 'admin' },
  })
})
test.afterEach(async () => {
  if (fixtures) {
    const payload = await getPayloadClient()
    const jobs = await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'notify-confirmation-paid' } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    for (const job of jobs.docs)
      if (fixtures.created.drugTestIds.includes((job.input as { testId?: string })?.testId || ''))
        await payload.delete({ collection: 'payload-jobs', id: job.id, overrideAccess: true })
  }
  await cleanupFixtures(fixtures)
})

test(
  'Results Next prepares a fee without waiting, and Back/Next does not duplicate it',
  { tag: '@critical' },
  async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await selectWorkflow(page, 'Enter Lab Screen Data')
    await goToLabScreenData(
      page,
      getE2EEnv({ pdfs: ['labScreen'] }).pdfLabScreenPath,
      fixtures.tests.labScreenCollectedTestId,
    )
    await page.getByRole('checkbox', { name: /^Fentanyl\b/i }).check()
    await selectResultDecision(page, 'request-confirmation')
    await clickNext(page)
    await expectWizardStep(page, 'review')
    const payload = await getPayloadClient()
    const first = await payload.findByID({
      collection: 'drug-tests',
      id: fixtures.tests.labScreenCollectedTestId,
      depth: 0,
    })
    expect(first.payment?.confirmationFeeDue).toBe(45)
    expect(first.payment?.confirmationFeePaid).toBe(0)
    expect(first.screeningStatus).toBe('collected')
    expect(first.testDocument).toBeFalsy()
    await clickBack(page)
    await expectWizardStep(page, 'results')
    await expect(page.locator('#request-confirmation')).toBeChecked()
    await page.getByRole('button', { name: 'Edit test details', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: /^Fentanyl\b/i }).first()).toBeChecked()
    await clickNext(page)
    await expectWizardStep(page, 'review')
    const repeated = await payload.findByID({ collection: 'drug-tests', id: first.id, depth: 0 })
    expect(repeated.payment?.amountDue).toBe(first.payment?.amountDue)
    expect(repeated.confirmationRequestKey).toBe(first.confirmationRequestKey)
    expect(repeated.screenedAt).toBe(first.screenedAt)
  },
)

test(
  'Stripe confirmation funds its test, queues the owner email once, and can be undone',
  { tag: '@critical' },
  async () => {
    const payload = await getPayloadClient()
    const id = fixtures.tests.labScreenCollectedTestId
    const resultDate = new Date(Date.now() - 2 * 86400000).toISOString()
    await prepareConfirmation({
      payload,
      user: owner,
      testId: id,
      decision: 'request-confirmation',
      substances: ['fentanyl'],
      screenedAt: resultDate,
    })
    await payload.update({
      collection: 'drug-tests',
      id,
      data: { detectedSubstances: ['fentanyl'], screeningStatus: 'screened' },
      overrideAccess: true,
    })
    const before = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
    expect(before.screeningStatus).toBe('screened')
    expect(before.confirmationHoldUntil).toBe(new Date(Date.parse(resultDate) + 30 * 86400000).toISOString())
    const older = await payload.create({
      collection: 'drug-tests',
      overrideAccess: true,
      data: {
        relatedClient: fixtures.clients.labScreen.id,
        testType: '11-panel-lab',
        collectionDate: '2020-01-01T00:00:00Z',
        screeningStatus: 'collected',
        payment: { status: 'unpaid', amountDue: 100, amountPaid: 0, balanceDue: 100 },
      },
    })
    fixtures.created.drugTestIds.push(older.id)
    let creationCount = 0
    const stripe = {
      checkout: {
        sessions: {
          create: async () => {
            creationCount++
            return { id: `cs_${fixtures.runId}`, status: 'open', url: 'https://checkout.stripe.com/test-confirmation' }
          },
          retrieve: async () => ({
            id: `cs_${fixtures.runId}`,
            status: 'open',
            url: 'https://checkout.stripe.com/test-confirmation',
          }),
        },
      },
    } as unknown as Stripe
    const started = new Date()
    await sendConfirmationPaymentLink(payload, id, stripe)
    await sendConfirmationPaymentLink(payload, id, stripe)
    expect(creationCount).toBe(1)
    const links = await payload.find({ collection: 'payments', where: { relatedDrugTest: { equals: id } }, depth: 0 })
    const payment = links.docs.find((p) => p.purpose === 'confirmation')!
    expect(payment.amount).toBe(45)
    const event = {
      data: {
        object: {
          id: payment.stripeCheckoutSessionId,
          amount_total: 4500,
          currency: 'usd',
          payment_status: 'unpaid',
          metadata: {
            paymentId: payment.id,
            clientId: fixtures.clients.labScreen.id,
            drugTestId: id,
            confirmationRequestKey: before.confirmationRequestKey,
          },
          payment_intent: `pi_${fixtures.runId}`,
        },
      },
    }
    await checkoutSessionCompleted({ payload, event } as never)
    expect(confirmationPaymentRequired(await payload.findByID({ collection: 'drug-tests', id, depth: 0 }))).toBe(true)
    event.data.object.payment_status = 'paid'
    await checkoutSessionCompleted({ payload, event } as never)
    await checkoutSessionCompleted({ payload, event } as never)
    const funded = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
    expect(funded.payment?.confirmationFeePaid).toBe(45)
    expect(funded.screeningStatus).toBe('confirmation-pending')
    expect((await payload.findByID({ collection: 'drug-tests', id: older.id, depth: 0 })).payment?.balanceDue).toBe(100)
    await payload.jobs.run({
      queue: 'redwood',
      sequential: true,
      where: { taskSlug: { equals: 'notify-confirmation-paid' } },
    })
    await payload.jobs.run({
      queue: 'redwood',
      sequential: true,
      where: { taskSlug: { equals: 'notify-confirmation-paid' } },
    })
    if (getE2EEnv().enableMailpitAssertions) {
      expect(
        (
          await findMailpitMessages({
            apiBase: getE2EEnv().mailpitApiBase,
            createdAfter: started,
            to: owner!.email!,
            subject: /.*/,
            requireAttachment: 'none',
          })
        ).length,
      ).toBe(1)
    }
    const posted = await payload.findByID({ collection: 'payments', id: payment.id, depth: 0 })
    expect(posted.allocations).toEqual([expect.objectContaining({ drugTest: id, amount: 45, confirmationAmount: 45 })])
    await withPayloadTransaction(
      payload,
      (req) =>
        reversePostedPayments({
          payload,
          clientId: fixtures.clients.labScreen.id,
          payments: [posted],
          reason: 'test undo',
          req,
        }),
      { requireTransaction: true },
    )
    const undone = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
    expect(undone.payment?.confirmationFeePaid).toBe(0)
    expect(undone.screeningStatus).toBe('screened')
  },
)

test('referral confirmation stays invoice eligible and requires no client payment', { tag: '@critical' }, async () => {
  const payload = await getPayloadClient()
  const id = fixtures.tests.labScreenCollectedTestId
  await payload.update({
    collection: 'employers',
    id: fixtures.referrals.employer.id,
    overrideAccess: true,
    data: { isBillable: true, billingEmail: fixtures.referrals.employer.recipientEmail },
  })
  await payload.update({
    collection: 'drug-tests',
    id,
    overrideAccess: true,
    data: {
      billingResponsibility: {
        payer: 'referral',
        referral: { relationTo: 'employers', value: fixtures.referrals.employer.id },
      },
    },
  })
  await prepareConfirmation({
    payload,
    user: owner,
    testId: id,
    decision: 'request-confirmation',
    substances: ['fentanyl'],
    screenedAt: new Date().toISOString(),
  })
  const testRecord = await payload.update({
    collection: 'drug-tests',
    id,
    overrideAccess: true,
    data: { detectedSubstances: ['fentanyl'], screeningStatus: 'screened' },
  })
  expect(testRecord.screeningStatus).toBe('confirmation-pending')
  expect(confirmationPaymentRequired(testRecord)).toBe(false)
  await expect(sendConfirmationPaymentLink(payload, id, {} as Stripe)).rejects.toThrow('billed to the referral')
  const preview = await previewReferralInvoice(
    payload,
    'employers',
    fixtures.referrals.employer.id,
    currentBillingMonth(),
  )
  expect(preview.items).toContainEqual(
    expect.objectContaining({ drugTest: id, amount: testRecord.payment!.balanceDue }),
  )
})

test(
  'existing client credit funds the fee and synchronizes the client balance in the same transaction',
  { tag: '@critical' },
  async () => {
    const payload = await getPayloadClient()
    const clientId = fixtures.clients.labScreen.id
    const id = fixtures.tests.labScreenCollectedTestId
    await payload.update({ collection: 'clients', id: clientId, overrideAccess: true, data: { creditBalance: 45 } })
    await prepareConfirmation({
      payload,
      user: owner,
      testId: id,
      decision: 'request-confirmation',
      substances: ['fentanyl'],
      screenedAt: new Date().toISOString(),
    })
    const testRecord = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
    const client = await payload.findByID({ collection: 'clients', id: clientId, depth: 0 })
    expect(testRecord.payment?.confirmationFeePaid).toBe(45)
    expect(client.creditBalance).toBe(0)
    expect(client.moneyOwed).toBe(testRecord.payment?.balanceDue)
  },
)

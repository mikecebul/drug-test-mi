import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
import { getPayloadClient } from './helpers/payload'
import { postAccountPayment } from '../../src/collections/Payments/services/accountPayment'
import type { PayloadRequest } from 'payload'
import {
  setCollectionPayer,
  reserveClientPaymentPayer,
  releaseClientPaymentPayer,
} from '../../src/lib/referral-invoices/booking-payer'

let fixtures: FixtureContext
let clientDebtId: string
let referralDebtId: string
const browserHeaders = { Origin: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000' }

test.describe('Standard staff views and account payments', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async () => {
    fixtures = await seedFixtures()
    const payload = await getPayloadClient()
    // Payload promotes the first user to super admin; this suite exercises a standard staff account.
    await payload.update({
      collection: 'admins',
      id: fixtures.admin.id,
      data: { role: 'admin' },
      req: { headers: { 'X-Payload-Migration': 'true' } } as never,
      overrideAccess: true,
    })
    const debt = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: fixtures.clients.instant.id,
        testType: '11-panel-lab',
        screeningStatus: 'collected',
        collectionDate: new Date().toISOString(),
        payment: { status: 'unpaid', amountDue: 40, amountPaid: 0, balanceDue: 40 },
      },
      overrideAccess: true,
    })
    clientDebtId = debt.id
    fixtures.created.drugTestIds.push(debt.id)
    await payload.update({
      collection: 'courts',
      id: fixtures.referrals.court.id,
      data: { isBillable: true, billingEmail: 'billing@example.test' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'clients',
      id: fixtures.clients.instant.id,
      data: { referralType: 'court', referral: { relationTo: 'courts', value: fixtures.referrals.court.id } },
      overrideAccess: true,
    })
    const referralDebt = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: fixtures.clients.instant.id,
        testType: '11-panel-lab',
        screeningStatus: 'collected',
        collectionDate: new Date().toISOString(),
        payment: { status: 'unpaid', amountDue: 80, amountPaid: 0, balanceDue: 80 },
      },
      overrideAccess: true,
    })
    referralDebtId = referralDebt.id
    fixtures.created.drugTestIds.push(referralDebt.id)
  })
  test.afterAll(async () => cleanupFixtures(fixtures))

  test('allows a standard admin to switch this collection to self-pay and continue unpaid', async ({ request }) => {
    const payload = await getPayloadClient()
    const client = fixtures.clients.instant
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        title: 'Staff payer exception',
        type: '15min',
        status: 'confirmed',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 900000).toISOString(),
        attendeeName: client.fullName,
        attendeeEmail: client.email,
        relatedClient: client.id,
        organizer: { name: 'Local test', email: 'local@example.test' },
        scheduledTestType: '11-panel-lab',
        payment: { amountDue: 80, amountPaid: 0, status: 'unpaid' },
      },
      overrideAccess: true,
    })
    fixtures.created.bookingIds = [...(fixtures.created.bookingIds || []), booking.id]
    expect(booking.billingResponsibility?.payer).toBe('referral')
    const login = await request.post('/api/admins/login', {
      data: { email: fixtures.admin.email, password: fixtures.admin.password },
    })
    expect(login.ok()).toBe(true)
    const switched = await request.post('/api/guided-workflow', {
      headers: browserHeaders,
      data: {
        operation: 'set-payer',
        input: { bookingId: booking.id, payer: 'client', expectedPayer: 'referral' },
      },
    })
    expect(switched.ok()).toBe(true)
    expect(await switched.json()).toMatchObject({ success: true, billingResponsibility: { payer: 'client' } })
    const continued = await request.post('/api/guided-workflow', {
      headers: browserHeaders,
      data: {
        operation: 'record-payment',
        input: {
          bookingId: booking.id,
          amountReceived: 0,
          creditApplied: 0,
          method: 'cash',
          operationId: randomUUID(),
          sendReceipt: false,
        },
      },
    })
    expect(continued.ok()).toBe(true)
    expect(await continued.json()).toMatchObject({ success: true, payment: { amountPaid: 0, status: 'unpaid' } })
    const updated = await payload.findByID({ collection: 'bookings', id: booking.id, depth: 0 })
    expect(updated.billingResponsibility?.payer).toBe('client')
    expect(updated.payment?.collectedAt).toBeTruthy()
    expect((await payload.findByID({ collection: 'courts', id: fixtures.referrals.court.id })).isBillable).toBe(true)
  })

  test(
    'lets a standard admin choose self-pay in the payment screen and continue with the balance owing',
    { tag: '@smoke' },
    async ({ page }) => {
      const payload = await getPayloadClient()
      const client = fixtures.clients.instant
      const booking = await payload.create({
        collection: 'bookings',
        data: {
          title: 'Staff payment UI',
          type: '15min',
          status: 'confirmed',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 900000).toISOString(),
          attendeeName: client.fullName,
          attendeeEmail: client.email,
          relatedClient: client.id,
          organizer: { name: 'Local test', email: 'local@example.test' },
          scheduledTestType: '11-panel-lab',
          payment: { amountDue: 80, amountPaid: 0, status: 'unpaid' },
        },
        overrideAccess: true,
      })
      fixtures.created.bookingIds = [...(fixtures.created.bookingIds || []), booking.id]
      await loginAdmin(page, fixtures.admin)
      await page.goto(`/admin/drug-test-upload?workflow=guided&step=payment&bookingId=${booking.id}`)
      await expect(page.getByText('Referral will be invoiced', { exact: true })).toBeVisible()
      await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toBeHidden()
      await page.screenshot({ path: test.info().outputPath('payment-referral.png'), fullPage: true })
      const billReferral = page.getByRole('switch', { name: 'Bill this referral', exact: true })
      await expect(billReferral).toBeChecked()
      await billReferral.click()
      await expect(billReferral).not.toBeChecked()
      await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toHaveValue('0')
      await expect(page.getByTestId('wizard-next-button')).toHaveText(/Continue with balance owing/)
      await page.screenshot({ path: test.info().outputPath('payment-client-exception.png'), fullPage: true })
      await page.getByTestId('wizard-next-button').click()
      const confirmation = page.getByRole('alertdialog', { name: 'Continue without payment?' })
      await expect(confirmation).toBeVisible()
      await confirmation.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Prepare lab collection' })).toBeVisible()
      const saved = await payload.findByID({ collection: 'bookings', id: booking.id, depth: 0 })
      expect(saved.billingResponsibility?.payer).toBe('client')
      expect(saved.payment?.amountPaid).toBe(0)
      expect(saved.payment?.collectedAt).toBeTruthy()
    },
  )

  test('rejects concurrent payer writes when transactions are unavailable', async () => {
    const payload = await getPayloadClient()
    const client = fixtures.clients.instant
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        title: 'Standalone payer concurrency',
        type: '15min',
        status: 'confirmed',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 900000).toISOString(),
        attendeeName: client.fullName,
        attendeeEmail: client.email,
        relatedClient: client.id,
        organizer: { name: 'Local test', email: 'local@example.test' },
        scheduledTestType: '11-panel-lab',
        payment: { amountDue: 80, amountPaid: 0, status: 'unpaid' },
      },
      overrideAccess: true,
    })
    fixtures.created.bookingIds = [...(fixtures.created.bookingIds || []), booking.id]
    const begin = payload.db.beginTransaction
    payload.db.beginTransaction = async () => null
    try {
      const operationId = randomUUID()
      const user = await payload.findByID({ collection: 'admins', id: fixtures.admin.id })
      await expect(
        postAccountPayment({
          payload,
          user: { ...user, collection: 'admins' },
          clientId: client.id,
          amount: 50,
          operationId,
        }),
      ).rejects.toThrow('No payment was recorded')
      expect(
        (await payload.find({ collection: 'payments', where: { accountOperationId: { equals: operationId } } }))
          .totalDocs,
      ).toBe(0)
      expect((await payload.findByID({ collection: 'drug-tests', id: clientDebtId })).payment?.balanceDue).toBe(40)
      const input = {
        payload,
        bookingId: booking.id,
        payer: 'client' as const,
        expectedPayer: 'referral' as const,
        userId: fixtures.admin.id,
      }
      const writes = await Promise.allSettled([setCollectionPayer(input), setCollectionPayer(input)])
      expect(writes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(writes.filter((result) => result.status === 'rejected')).toHaveLength(1)
      await reserveClientPaymentPayer(payload, booking.id, client.id, 'reservation-1')
      await expect(setCollectionPayer({ ...input, payer: 'referral', expectedPayer: 'client' })).rejects.toThrow(
        'card payment',
      )
      await releaseClientPaymentPayer(payload, booking.id, 'old-reservation')
      expect(
        (await payload.findByID({ collection: 'bookings', id: booking.id })).billingResponsibility?.paymentOperationId,
      ).toBe('reservation-1')
      await releaseClientPaymentPayer(payload, booking.id, 'reservation-1')
      await setCollectionPayer({ ...input, payer: 'referral', expectedPayer: 'client' })
    } finally {
      payload.db.beginTransaction = begin
    }
  })

  test('uses native staff navigation and summary/edit tabs without staff deletion', async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await page.goto(`/admin/collections/clients/${fixtures.clients.instant.id}/summary`)
    await expect(page.getByRole('heading', { name: fixtures.clients.instant.fullName, exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('Balances', { exact: true })).toBeVisible()
    await expect(page.getByText('Referral-billed balance', { exact: true })).toBeVisible()
    await expect(page.getByText(fixtures.clients.instant.id, { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Collect Payment', exact: true })).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Referral Billing', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Pages', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Quick Book', exact: true })).toHaveCount(2) // Sidebar and one client action.
    const edit = page.getByRole('button', { name: 'Edit client', exact: true })
    await edit.click()
    await expect(page.locator('input[name="firstName"]')).toHaveValue(fixtures.clients.instant.firstName, {
      timeout: 30_000,
    })
    const denied = await page.request.delete(`/api/clients/${fixtures.clients.instant.id}`, { headers: browserHeaders })
    expect(denied.status()).toBe(403)
    await page.goto(`/admin/collections/courts/${fixtures.referrals.court.id}/summary`)
    await expect(page.getByRole('heading', { name: fixtures.referrals.court.name, exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: 'Edit referral', exact: true })).toBeVisible()
    expect(
      (await page.request.delete(`/api/courts/${fixtures.referrals.court.id}`, { headers: browserHeaders })).status(),
    ).toBe(403)
  })

  test('rolls back the complete account payment after an allocation failure and deduplicates concurrent retries', async () => {
    const payload = await getPayloadClient()
    const user = await payload.findByID({ collection: 'admins', id: fixtures.admin.id, overrideAccess: true })
    const principal = { ...user, collection: 'admins' as const } as PayloadRequest['user']
    const failedOperation = randomUUID()
    type TestUpdate = (args: { collection: string; data: { status?: string } }) => Promise<unknown>
    const originalUpdate = payload.update
    const updateInTest = originalUpdate as unknown as TestUpdate
    payload.update = (async (args: { collection: string; data: { status?: string } }) => {
      if (args.collection === 'payments' && args.data.status === 'posted') throw new Error('Injected ledger failure')
      return updateInTest.call(payload, args)
    }) as unknown as typeof payload.update
    try {
      await expect(
        postAccountPayment({
          payload,
          user: principal,
          clientId: fixtures.clients.instant.id,
          amount: 50,
          operationId: failedOperation,
        }),
      ).rejects.toThrow('Injected ledger failure')
    } finally {
      payload.update = originalUpdate
    }
    expect((await payload.findByID({ collection: 'drug-tests', id: clientDebtId })).payment?.balanceDue).toBe(40)
    expect(
      (await payload.findByID({ collection: 'clients', id: fixtures.clients.instant.id })).creditBalance || 0,
    ).toBe(0)
    expect(
      (await payload.find({ collection: 'payments', where: { accountOperationId: { equals: failedOperation } } }))
        .totalDocs,
    ).toBe(0)
    const operationId = randomUUID()
    const input = { payload, user: principal, clientId: fixtures.clients.instant.id, amount: 50, operationId }
    const concurrent = await Promise.allSettled([postAccountPayment(input), postAccountPayment(input)])
    expect(concurrent.some((result) => result.status === 'fulfilled')).toBe(true)
    expect(await postAccountPayment(input)).toMatchObject({ success: true, appliedAmount: 40, creditAdded: 10 })
    expect(
      (await payload.find({ collection: 'payments', where: { accountOperationId: { equals: operationId } } }))
        .totalDocs,
    ).toBe(1)
    expect((await payload.findByID({ collection: 'drug-tests', id: clientDebtId })).payment?.balanceDue).toBe(0)
    expect((await payload.findByID({ collection: 'drug-tests', id: referralDebtId })).payment?.balanceDue).toBe(80)
    expect((await payload.findByID({ collection: 'clients', id: fixtures.clients.instant.id })).creditBalance).toBe(10)
  })

  test(
    'records account credit without a booking and reconciles a lost response with the same operation',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      const payload = await getPayloadClient()
      // Arrange this balance independently of the preceding service regression.
      await payload.update({
        collection: 'drug-tests',
        id: clientDebtId,
        data: { payment: { status: 'paid', amountDue: 40, amountPaid: 40, balanceDue: 0 } },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'clients',
        id: fixtures.clients.instant.id,
        data: { creditBalance: 10 },
        overrideAccess: true,
      })
      await loginAdmin(page, fixtures.admin)
      await page.goto(`/admin/collect-payment?clientId=${fixtures.clients.instant.id}`)
      await expect(page.getByRole('heading', { name: 'Collect payment', exact: true })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('spinbutton', { name: 'Amount received', exact: true })).toBeEnabled({
        timeout: 30_000,
      })
      await expect(page.getByRole('radio', { name: 'Card', exact: true })).toBeDisabled()
      await page.getByRole('spinbutton', { name: 'Amount received', exact: true }).fill('20')
      await page.getByRole('checkbox', { name: /Email receipt/i }).uncheck()
      const bookingsBefore = (
        await payload.find({
          collection: 'bookings',
          where: { relatedClient: { equals: fixtures.clients.instant.id } },
        })
      ).totalDocs
      let recordedRequest: { operationId: string } | undefined
      let intercepted = false
      await page.route('**/api/account-payments', async (route) => {
        if (route.request().method() !== 'POST' || intercepted) return route.continue()
        intercepted = true
        recordedRequest = route.request().postDataJSON()
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        await route.abort('failed') // The server committed, but the browser did not receive success.
      })
      await page.getByRole('button', { name: 'Record $20.00 cash payment', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Check payment status', exact: true })).toBeEnabled({
        timeout: 30_000,
      })
      await expect(page.getByRole('spinbutton', { name: 'Amount received', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Change client', exact: true })).toBeDisabled()
      await page.getByRole('button', { name: 'Check payment status', exact: true }).click()
      await expect(page.getByText('Payment recorded', { exact: true })).toBeVisible({ timeout: 30_000 })
      expect(
        (
          await payload.find({
            collection: 'payments',
            where: { accountOperationId: { equals: recordedRequest!.operationId } },
          })
        ).totalDocs,
      ).toBe(1)
      expect((await payload.findByID({ collection: 'clients', id: fixtures.clients.instant.id })).creditBalance).toBe(
        30,
      )
      expect(
        (
          await payload.find({
            collection: 'bookings',
            where: { relatedClient: { equals: fixtures.clients.instant.id } },
          })
        ).totalDocs,
      ).toBe(bookingsBefore)
      expect((await payload.findByID({ collection: 'drug-tests', id: referralDebtId })).payment?.balanceDue).toBe(80)
    },
  )
})

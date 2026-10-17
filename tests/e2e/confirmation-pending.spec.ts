import { expect, test } from '@playwright/test'
import type Stripe from 'stripe'
import type { Admin, DrugTest } from '../../src/payload-types'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { cleanupFixtures } from './helpers/cleanup'
import { getPayloadClient } from './helpers/payload'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import { findMailpitMessages } from './helpers/mailpit'
import { prepareConfirmation } from '../../src/collections/DrugTests/confirmation/prepare'
import { sendConfirmationPaymentLink } from '../../src/collections/DrugTests/confirmation/paymentLink'
import { postAccountPayment } from '../../src/collections/Payments/services/accountPayment'
import { confirmationPaymentRequired } from '../../src/collections/DrugTests/confirmation/policy'
import { makeReportPdf } from '../../src/utilities/extractors/__tests__/helpers/reportPdf'
import {
  selectWorkflow,
  uploadSinglePdf,
  waitForExtractStepReady,
  selectLabCollection,
  goToLabScreenData,
  editScreeningReport,
  applyScreeningReportEdits,
  selectResultDecision,
  clickBack,
  clickNext,
  expectWizardStep,
} from './helpers/wizard'

let fixtures: FixtureContext
let admin: Admin & { collection: 'admins' }
test.beforeEach(async () => {
  fixtures = await seedFixtures()
  const payload = await getPayloadClient()
  const bootstrap = {
    ...fixtures.admin,
    role: 'superAdmin',
    collection: 'admins',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as const
  const owner = await payload.create({
    collection: 'admins',
    overrideAccess: true,
    user: { ...bootstrap, collection: 'admins' },
    req: { headers: { 'X-Payload-Migration': 'true' } as unknown as Headers },
    data: {
      name: 'Pending Review Owner',
      email: `pending-owner.${fixtures.runId}@example.com`,
      role: 'superAdmin',
      password: 'StrongPass123!',
    },
  })
  fixtures.created.adminIds.push(owner.id)
  const storedOwner = await payload.findByID({
    collection: 'admins',
    id: owner.id,
    user: bootstrap,
    overrideAccess: true,
  })
  await payload.update({
    collection: 'admins',
    id: fixtures.admin.id,
    overrideAccess: true,
    user: { ...storedOwner, collection: 'admins' },
    req: { headers: { 'X-Payload-Migration': 'true' } as unknown as Headers },
    data: { role: 'admin' },
  })
  const saved = await payload.findByID({
    collection: 'admins',
    id: fixtures.admin.id,
    user: bootstrap,
    overrideAccess: true,
  })
  admin = { ...saved, collection: 'admins' }
  expect(admin.role).toBe('admin')
})
test.afterEach(async () => {
  const payload = await getPayloadClient()
  const payments = await payload.find({
    collection: 'payments',
    where: { relatedDrugTest: { in: fixtures.created.drugTestIds } },
    limit: 100,
    depth: 0,
  })
  for (const payment of payments.docs)
    await payload.delete({ collection: 'payments', id: payment.id, overrideAccess: true })
  await cleanupFixtures(fixtures)
})

test(
  'standalone pending fees and concurrent payment links do not post money or consume credit',
  { tag: '@critical' },
  async () => {
    const payload = await getPayloadClient()
    test.skip(
      process.env.E2E_STANDALONE_CONFIRMATION !== 'true',
      'This case deliberately verifies a database without transactions.',
    )
    const id = fixtures.tests.labScreenCollectedTestId
    const clientId = fixtures.clients.labScreen.id
    await payload.update({ collection: 'clients', id: clientId, data: { creditBalance: 90 }, overrideAccess: true })
    const original = (await payload.db.findOne({
      collection: 'drug-tests',
      where: { id: { equals: id } },
    })) as unknown as DrugTest
    const input = {
      payload,
      user: admin,
      testId: id,
      decision: 'request-confirmation' as const,
      substances: ['fentanyl'],
      screenedAt: new Date().toISOString(),
    }
    const concurrent = await Promise.allSettled([prepareConfirmation(input), prepareConfirmation(input)])
    expect(concurrent.some((r) => r.status === 'fulfilled')).toBe(true)
    const first = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
    await prepareConfirmation(input)
    const repeated = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
    expect(repeated.payment).toMatchObject({
      confirmationFeeDue: 45,
      confirmationFeePaid: 0,
      amountPaid: first.payment?.amountPaid,
    })
    expect(repeated.confirmationRequestKey).toBe(first.confirmationRequestKey)
    expect(repeated.screenedAt).toBe(first.screenedAt)
    expect(
      ((await payload.db.findOne({ collection: 'drug-tests', where: { id: { equals: id } } })) as unknown as DrugTest)
        ?.clientName,
    ).toBe(original?.clientName)
    expect((await payload.findByID({ collection: 'clients', id: clientId })).creditBalance).toBe(90)
    const session = {
      id: `cs_pending_${fixtures.runId}`,
      url: 'https://checkout.stripe.com/pending-example',
      status: 'open',
    }
    const stripe = {
      checkout: { sessions: { create: async () => session, retrieve: async () => session } },
    } as unknown as Stripe
    const started = new Date()
    await Promise.all([
      sendConfirmationPaymentLink(payload, id, stripe),
      sendConfirmationPaymentLink(payload, id, stripe),
    ])
    const payments = await payload.find({
      collection: 'payments',
      where: { relatedDrugTest: { equals: id } },
      limit: 100,
      depth: 0,
    })
    expect(payments.docs).toHaveLength(1)
    expect(payments.docs[0]).toMatchObject({
      status: 'pending',
      amount: 45,
      confirmationRequestKey: first.confirmationRequestKey,
    })
    expect(payments.docs[0].paymentLinkEmailSentAt).toBeTruthy()
    const afterLinks = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
    expect(afterLinks.payment).toMatchObject({
      confirmationFeeDue: 45,
      confirmationFeePaid: 0,
      amountPaid: first.payment?.amountPaid,
    })
    expect(afterLinks.billingResponsibility).toMatchObject({ payer: 'client' })
    expect(afterLinks.confirmationRequestKey).toBe(first.confirmationRequestKey)
    expect(
      await findMailpitMessages({
        apiBase: getE2EEnv({ requirePdfs: false }).mailpitApiBase,
        createdAfter: started,
        to: fixtures.clients.labScreen.email,
        subject: 'Confirmation testing payment link',
      }),
    ).toHaveLength(1)
    expect((await payload.findByID({ collection: 'clients', id: clientId })).creditBalance).toBe(90)
    await expect(
      postAccountPayment({
        payload,
        user: admin,
        clientId,
        amount: 10,
        operationId: `guard-${fixtures.runId}`,
      }),
    ).rejects.toThrow('transactional database')
    expect((await payload.find({ collection: 'payments', where: { relatedDrugTest: { equals: id } } })).totalDocs).toBe(
      1,
    )
  },
)

test('standard admins can authorize unpaid confirmation without marking its fee paid', async () => {
  const payload = await getPayloadClient()
  const id = fixtures.tests.labScreenCollectedTestId
  await payload.update({
    collection: 'clients',
    id: fixtures.clients.labScreen.id,
    data: { creditBalance: 90 },
    overrideAccess: true,
  })
  await prepareConfirmation({
    payload,
    user: admin,
    testId: id,
    decision: 'request-confirmation',
    substances: ['fentanyl'],
    screenedAt: new Date().toISOString(),
    bypassPaymentRequirement: true,
  })
  const saved = await payload.findByID({ collection: 'drug-tests', id, depth: 0 })
  expect(saved.payment).toMatchObject({
    confirmationPaymentBypassed: true,
    confirmationPaymentBypassedBy: admin.id,
    confirmationFeeDue: 45,
    confirmationFeePaid: 0,
  })
  expect(saved.payment?.confirmationPaymentBypassedAt).toBeTruthy()
  expect(confirmationPaymentRequired(saved)).toBe(false)
  expect((await payload.findByID({ collection: 'clients', id: fixtures.clients.labScreen.id })).creditBalance).toBe(90)
})

test(
  'standard admin can advance screening with an unpaid confirmation and retain it on Back',
  { tag: '@critical' },
  async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await selectWorkflow(page, 'Enter Lab Screen Data')
    await goToLabScreenData(
      page,
      getE2EEnv({ pdfs: ['labScreen'] }).pdfLabScreenPath,
      fixtures.tests.labScreenCollectedTestId,
    )
    const editor = await editScreeningReport(page)
    await editor.getByRole('checkbox', { name: /^Fentanyl\b/i }).check()
    await applyScreeningReportEdits(page)
    await selectResultDecision(page, 'request-confirmation')
    // Checkout/email is exercised above with mocked Stripe; this browser flow sends nothing externally.
    await page.getByRole('checkbox', { name: 'Email client a Stripe payment link' }).uncheck()
    await clickNext(page)
    await expectWizardStep(page, 'review')
    const payload = await getPayloadClient()
    const stored = await payload.findByID({
      collection: 'drug-tests',
      id: fixtures.tests.labScreenCollectedTestId,
      depth: 0,
    })
    expect(stored.payment).toMatchObject({ confirmationFeeDue: 45, confirmationFeePaid: 0 })
    await clickBack(page)
    await expectWizardStep(page, 'results')
    await expect(page.getByRole('checkbox', { name: 'Email client a Stripe payment link' })).not.toBeChecked()
    await clickNext(page)
    await expectWizardStep(page, 'review')
    expect((await payload.findByID({ collection: 'drug-tests', id: stored.id, depth: 0 })).confirmationRequestKey).toBe(
      stored.confirmationRequestKey,
    )
  },
)

test('identity checkbox and unselected collection circles have visible boundaries before validation', async ({
  page,
}) => {
  const payload = await getPayloadClient()
  await payload.update({
    collection: 'clients',
    id: fixtures.clients.labScreen.id,
    data: { dob: '1991-01-15T00:00:00.000Z', lastName: 'Profile' },
    user: admin,
    overrideAccess: true,
  })
  const alternative = await payload.create({
    collection: 'drug-tests',
    overrideAccess: true,
    user: admin,
    data: {
      relatedClient: fixtures.clients.labScreen.id,
      testType: '11-panel-lab',
      screeningStatus: 'collected',
      collectionDate: new Date().toISOString(),
      payment: { amountDue: 40, amountPaid: 0, status: 'unpaid' },
    },
  })
  fixtures.created.drugTestIds.push(alternative.id)
  await page.setViewportSize({ width: 606, height: 853 })
  await loginAdmin(page, fixtures.admin)
  await selectWorkflow(page, 'Enter Lab Screen Data')
  await uploadSinglePdf(page, getE2EEnv({ pdfs: ['labScreen'] }).pdfLabScreenPath)
  await waitForExtractStepReady(page)
  await clickNext(page)
  await expectWizardStep(page, 'match')
  await selectLabCollection(page, fixtures.tests.labScreenCollectedTestId)
  const checkbox = page.getByTestId('lab-report-identity-confirmation')
  await expect(checkbox).toBeVisible()
  await expect(checkbox).not.toHaveAttribute('aria-invalid', 'true')
  const controls = [
    checkbox,
    page
      .getByTestId('lab-collection-choices')
      .locator('button[aria-pressed="false"]')
      .first()
      .locator('[data-slot="collection-choice-indicator"]'),
  ]
  for (const control of controls) {
    const stats = await control.evaluate((node) => {
      const canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d')!
      const rgb = (color: string) => {
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const luminance = (color: string) =>
        rgb(color)
          .map((v) => {
            const s = v / 255
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
      const style = getComputedStyle(node)
      let surface = node.parentElement
      while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)')
        surface = surface.parentElement
      if (!surface) throw new Error('Control surface not found')
      const a = luminance(style.borderTopColor),
        b = luminance(getComputedStyle(surface).backgroundColor)
      return { contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), width: parseFloat(style.borderTopWidth) }
    })
    expect(stats.width).toBeGreaterThanOrEqual(2)
    expect(stats.contrast).toBeGreaterThanOrEqual(3)
  }
  await page.screenshot({ path: test.info().outputPath('lab-match-controls-portrait.png'), fullPage: true })
})

test('standalone lab credit rejects safely while pending confirmation remains available', async ({ page }) => {
  test.skip(process.env.E2E_STANDALONE_CONFIRMATION !== 'true', 'Needs the dedicated standalone test database')
  const payload = await getPayloadClient(),
    clientId = fixtures.clients.labScreen.id
  await payload.update({ collection: 'clients', id: clientId, overrideAccess: true, data: { creditBalance: 90 } })
  await loginAdmin(page, fixtures.admin)
  await selectWorkflow(page, 'Enter Lab Screen Data')
  await goToLabScreenData(
    page,
    getE2EEnv({ pdfs: ['labScreen'] }).pdfLabScreenPath,
    fixtures.tests.labScreenCollectedTestId,
  )
  const editor = await editScreeningReport(page)
  await editor.getByRole('checkbox', { name: /^Fentanyl\b/i }).check()
  await applyScreeningReportEdits(page)
  await selectResultDecision(page, 'request-confirmation')
  const credit = page.getByRole('checkbox', { name: 'Use $45.00 account credit', exact: true })
  await credit.check()
  await clickNext(page)
  await expectWizardStep(page, 'results')
  await expect(page.getByRole('alert').filter({ hasText: /credit.*transactions/i })).toBeVisible()
  expect((await payload.findByID({ collection: 'clients', id: clientId, depth: 0 })).creditBalance).toBe(90)
  await credit.uncheck()
  await clickNext(page)
  await expectWizardStep(page, 'review')
  const record = await payload.findByID({
    collection: 'drug-tests',
    id: fixtures.tests.labScreenCollectedTestId,
    depth: 0,
  })
  expect(record.payment).toMatchObject({ confirmationFeeDue: 45, confirmationFeePaid: 0 })
  expect((await payload.findByID({ collection: 'clients', id: clientId, depth: 0 })).creditBalance).toBe(90)
})

test('admins match by collection: live exact names lead and changing collections resets identity verification', async ({
  page,
}) => {
  const payload = await getPayloadClient()
  // Change the profile without rewriting the test's cached clientName.
  await payload.update({
    collection: 'clients',
    id: fixtures.clients.labScreen.id,
    user: admin,
    overrideAccess: true,
    data: { firstName: 'Zelda', middleInitial: 'Q', lastName: 'Donor' },
  })
  const alternatives: string[] = []
  for (const [clientId, collectionDate] of [
    [fixtures.clients.collectLab.id, '2026-05-23T12:00:00Z'],
    [fixtures.clients.instant.id, '2026-05-24T12:00:00Z'],
    [fixtures.clients.instant.id, '2026-05-25T12:00:00Z'],
  ]) {
    const record = await payload.create({
      collection: 'drug-tests',
      overrideAccess: true,
      user: admin,
      data: {
        relatedClient: clientId,
        testType: '11-panel-lab',
        screeningStatus: 'collected',
        collectionDate,
        payment: { amountDue: 0, amountPaid: 0, status: 'unpaid' },
      },
    })
    fixtures.created.drugTestIds.push(record.id)
    alternatives.push(record.id)
  }
  await page.setViewportSize({ width: 768, height: 1024 })
  await loginAdmin(page, fixtures.admin)
  const accessible = await payload.findByID({
    collection: 'drug-tests',
    id: fixtures.tests.labScreenCollectedTestId,
    user: admin,
    overrideAccess: false,
    depth: 0,
  })
  expect(accessible.clientName).not.toContain('Zelda')
  await selectWorkflow(page, 'Enter Lab Screen Data')
  const buffer = makeReportPdf([
    [
      { x: 40, y: 760, text: 'B729 - Urine 11 Panel' },
      { x: 40, y: 740, text: 'Identification:' },
      { x: 160, y: 740, text: 'Zelda Q. Donor' },
      { x: 40, y: 720, text: 'Collected:' },
      { x: 160, y: 720, text: '01/01/1999 11:11 PM' },
      { x: 40, y: 700, text: 'DOB:' },
      { x: 160, y: 700, text: '01/14/1990' },
      { x: 40, y: 500, text: 'Drug Class' },
      { x: 240, y: 500, text: 'Method' },
      { x: 350, y: 500, text: 'Cutoff' },
      { x: 470, y: 500, text: 'Result' },
      { x: 40, y: 475, text: 'Amphetamines 500' },
      { x: 240, y: 475, text: 'EIA' },
      { x: 350, y: 475, text: '5 ng/mL' },
      { x: 470, y: 475, text: 'Negative' },
    ],
  ])
  await page
    .locator('[data-slot="file-upload"] input[type="file"]')
    .first()
    .setInputFiles({ name: 'name-match.pdf', mimeType: 'application/pdf', buffer })
  await waitForExtractStepReady(page)
  await clickNext(page)
  await expectWizardStep(page, 'match')
  const choices = page.getByTestId('lab-collection-choices').getByRole('button')
  const matchedId = fixtures.tests.labScreenCollectedTestId
  await expect(choices).toHaveCount(3)
  await expect(choices.first()).toHaveAttribute('data-testid', `pending-test-${matchedId}`)
  await expect(choices.first()).toContainText('Zelda Q Donor')
  // Name ranking alone cannot auto-select a collection with a different date.
  await expect(page.getByTestId('lab-collection-choices').locator('button[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^(Choose|Change) client$/ })).toHaveCount(0)
  await selectLabCollection(page, matchedId)
  const context = page.getByTestId('lab-client-context')
  const verification = context.getByTestId('lab-report-identity-confirmation')
  await expect(context).toContainText('Zelda Q Donor')
  await expect(context.getByTestId('identity-notice')).toBeVisible()
  await verification.check()
  await expect(verification).toBeChecked()
  await page.screenshot({ path: test.info().outputPath('lab-match-grouped-client.png'), fullPage: true })
  await selectLabCollection(page, alternatives[0])
  await expect(context).toContainText(fixtures.clients.collectLab.fullName)
  await expect(verification).not.toBeChecked()
  await clickNext(page)
  await expectWizardStep(page, 'match')
  await expect(verification).toHaveAttribute('aria-invalid', 'true')
  await selectLabCollection(page, matchedId)
  await expect(context).toContainText('Zelda Q Donor')
  await expect(verification).not.toBeChecked()
})

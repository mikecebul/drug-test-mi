import { expect, test } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { assertNotificationSent, getDrugTestById } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import { ensureMailpitReachable, findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { clickBack, clickNext, extractTestIdFromSuccess, openWizard, selectClientFromSearchDialog, selectWorkflow } from './helpers/wizard'

let fixtures: FixtureContext

function isoDateTimeForInput(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

test.describe('Wizard Collect Lab Workflow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    fixtures = await seedFixtures()
    const env = getE2EEnv({ requirePdfs: false })
    if (env.enableMailpitAssertions) {
      await ensureMailpitReachable(env.mailpitApiBase)
    }
  })

  test.afterAll(async () => {
    await cleanupFixtures(fixtures)
  })

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await openWizard(page)
    await selectWorkflow(page, 'Collect Sample for Lab')
  })

  test('validates client/collection/email-required branches and supports back-forward navigation', async ({ page }) => {
    await clickNext(page)
    await expect(page.getByText('Please select a client')).toBeVisible()

    await selectClientFromSearchDialog(page, fixtures.clients.collectLab.fullName)
    await clickNext(page)
    await clickNext(page)

    await expect(page.getByRole('heading', { name: 'Collection Details' })).toBeVisible()

    await page.locator('#collection-date').fill('')
    await page.locator('#collection-date').press('Tab')
    await clickNext(page)
    await expect(page.getByText('Collection date is required')).toBeVisible()

    await page.locator('#collection-date').fill(isoDateTimeForInput('2026-01-07T23:11:00-05:00'))
    await page.locator('#collection-date').press('Tab')

    await page.getByLabel(/Breathalyzer test was administered/i).check()
    await clickNext(page)
    await expect(page.getByText('Breathalyzer result is required')).toBeVisible()

    await page.locator('#breathalyzerResult').fill('0.000')
    await clickNext(page)

    await expect(page.getByRole('heading', { name: 'Confirm Collection Details' })).toBeVisible()
    await clickBack(page)
    await expect(page.getByRole('heading', { name: 'Collection Details' })).toBeVisible()
    await clickNext(page)

    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Review Collection Notification' })).toBeVisible()

    await page.getByLabel(/Send referral notifications/i).check()
    await expect(page.getByText('Referral emails must have at least one recipient')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Submit$/i })).toBeDisabled()
  })

  test('submits collect-lab workflow, creates test, and verifies collected-stage email in Mailpit', async ({ page }) => {
    const env = getE2EEnv({ requirePdfs: false })
    const testStart = new Date()

    await selectClientFromSearchDialog(page, fixtures.clients.collectLab.fullName)
    await clickNext(page)
    await clickNext(page)

    await page.locator('#collection-date').fill(isoDateTimeForInput(new Date().toISOString()))
    await page.locator('#collection-date').press('Tab')
    await clickNext(page)

    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Review Collection Notification' })).toBeVisible()

    await page.getByLabel(/Send referral notifications/i).check()
    let recipientInputs = page.getByPlaceholder('email@example.com')
    if ((await recipientInputs.count()) === 0) {
      await page.getByRole('button', { name: /Add Recipient/i }).click()
      recipientInputs = page.getByPlaceholder('email@example.com')
    }

    const referralRecipients: string[] = []
    const inputCount = await recipientInputs.count()
    for (let index = 0; index < inputCount; index++) {
      const recipient = `collect.ref.${fixtures.runId}.${Date.now()}.${index}@example.com`
      await recipientInputs.nth(index).fill(recipient)
      referralRecipients.push(recipient)
    }

    await page.getByRole('button', { name: /^Submit$/i }).click()

    await expect(page.getByRole('heading', { name: 'Drug Test Created Successfully!' })).toBeVisible({ timeout: 30_000 })

    const testId = await extractTestIdFromSuccess(page)
    fixtures.created.drugTestIds.push(testId)

    const testRecord = await assertNotificationSent({ testId, stage: 'collected' })

    expect(testRecord.screeningStatus).toBe('collected')

    const expectedSubject = `Drug Test Sample Collected - ${fixtures.clients.collectLab.firstName} ${fixtures.clients.collectLab.lastName}`

    if (env.enableMailpitAssertions) {
      const messages = await findMailpitMessages({
        apiBase: env.mailpitApiBase,
        createdAfter: testStart,
        to: referralRecipients[0],
        subject: expectedSubject,
        requireAttachment: 'none',
        timeoutMs: 45_000,
      })
      expect(messages.length).toBeGreaterThan(0)
    }

    const refreshed = await getDrugTestById(testId)
    expect(refreshed.notificationsSent?.length || 0).toBeGreaterThan(0)
  })
})

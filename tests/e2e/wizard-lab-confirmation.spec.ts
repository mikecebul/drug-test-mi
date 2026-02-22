import { expect, test, type Page } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { assertNotificationSent, getDrugTestById } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import { ensureMailpitReachable, findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import {
  clickBack,
  clickNext,
  expectNextDisabled,
  extractTestIdFromSuccess,
  openWizard,
  selectWorkflow,
  triggerNextValidation,
  uploadSinglePdf,
  waitForExtractStepReady,
} from './helpers/wizard'

let fixtures: FixtureContext

async function ensureMatchSelected(page: Page) {
  const headingPattern = new RegExp(`${fixtures.clients.labConfirm.firstName}\\s+.*${fixtures.clients.labConfirm.lastName}`, 'i')
  const candidateHeading = page.getByRole('heading', { name: headingPattern }).first()
  await expect(candidateHeading).toBeVisible({ timeout: 20_000 })

  const headingCard = candidateHeading.locator('xpath=ancestor::*[contains(@class, "cursor-pointer")][1]')
  if ((await headingCard.count()) > 0) {
    await headingCard.click()
  } else {
    await candidateHeading.click()
  }
  await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled()
}

test.describe('Wizard Lab Confirmation Workflow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    fixtures = await seedFixtures()
    const env = getE2EEnv()
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
    await selectWorkflow(page, 'Enter Lab Confirmation Data')
  })

  test('validates upload/match/confirmation-result-required branches with back-forward navigation', async ({ page }) => {
    const env = getE2EEnv()

    await clickNext(page)
    await expect(page.getByText('Please upload a PDF file')).toBeVisible()

    // Use the lab-screen PDF to force empty confirmation results in this workflow.
    await uploadSinglePdf(page, env.pdfLabScreenPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Confirmation Data Extracted/i],
    })
    await clickNext(page)

    const matchRequiredAlert = page.getByText('Please select a test to continue')
    if (await matchRequiredAlert.isVisible().catch(() => false)) {
      await clickNext(page)
      await expect(matchRequiredAlert).toBeVisible()
    }

    await ensureMatchSelected(page)
    await clickNext(page)

    await expect(page.getByText('Enter Confirmation Results')).toBeVisible()
    await triggerNextValidation(page)
    await expect(page.getByText('At least one confirmation result is required')).toBeVisible()
    await expectNextDisabled(page)

    await clickBack(page)
    await expect(page.getByText('Match Test for Confirmation')).toBeVisible()
    await clickNext(page)
    await expect(page.getByText('Enter Confirmation Results')).toBeVisible()
  })

  test('submits lab-confirmation workflow, completes test, and verifies final-result emails with attachment', async ({ page }) => {
    const env = getE2EEnv()

    await uploadSinglePdf(page, env.pdfLabConfirmPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Confirmation Data Extracted/i],
    })
    await clickNext(page)
    await ensureMatchSelected(page)
    await clickNext(page)

    await expect(page.getByText('Enter Confirmation Results')).toBeVisible()
    await clickNext(page)
    await clickNext(page)

    await expect(page.getByText('Review Confirmation Notification Emails')).toBeVisible()

    const testStart = new Date()
    await page.getByRole('button', { name: /^Update Test Record$/i }).click()

    await expect(page.getByRole('heading', { name: 'Drug Test Created Successfully!' })).toBeVisible({ timeout: 30_000 })

    const testId = await extractTestIdFromSuccess(page)
    fixtures.created.drugTestIds.push(testId)

    const testRecord = await assertNotificationSent({ testId, stage: 'complete' })

    expect(testRecord.screeningStatus).toBe('complete')

    const refreshed = await getDrugTestById(testId)
    expect((refreshed.confirmationResults || []).length).toBeGreaterThan(0)

    const expectedSubject = `Final Drug Test Results - ${fixtures.clients.labConfirm.firstName} ${fixtures.clients.labConfirm.lastName}`

    if (env.enableMailpitAssertions) {
      await findMailpitMessages({
        apiBase: env.mailpitApiBase,
        createdAfter: testStart,
        to: fixtures.clients.labConfirm.email,
        subject: expectedSubject,
        requireAttachment: 'some',
        timeoutMs: 45_000,
      })

      await findMailpitMessages({
        apiBase: env.mailpitApiBase,
        createdAfter: testStart,
        to: fixtures.clients.labConfirm.referralRecipients[0],
        subject: expectedSubject,
        requireAttachment: 'some',
        timeoutMs: 45_000,
      })
    }
  })
})

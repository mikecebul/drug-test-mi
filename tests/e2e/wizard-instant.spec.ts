import { expect, test } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { assertNotificationSent } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import { ensureMailpitReachable, findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import {
  clickBack,
  clickNext,
  extractTestIdFromSuccess,
  goToEmailsStepFromInstant,
  openWizard,
  selectClientFromSearchDialog,
  selectWorkflow,
  triggerNextValidation,
  uploadSinglePdf,
  waitForExtractStepReady,
} from './helpers/wizard'

let fixtures: FixtureContext

function subjectForClient(prefix: string, person: FixtureContext['clients']['instant']) {
  return `${prefix} - ${person.firstName} ${person.lastName}`
}

test.describe('Wizard Instant Workflow', () => {
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
    await selectWorkflow(page, 'Screen Instant Test')
  })

  test('validates upload and confirmation-decision branches, with back-forward navigation', async ({ page }) => {
    const env = getE2EEnv()

    await clickNext(page)
    await expect(page.getByText('Please upload a PDF file')).toBeVisible()

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Extract Data/i],
    })
    await clickNext(page)

    await expect(page.getByRole('heading', { name: /Choose a Client/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Selected Client', { exact: true })).toHaveCount(0)
    await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)

    await clickNext(page)
    await clickNext(page)

    await expect(page.getByText('Verify Test Data')).toBeVisible()

    const testTypeInput = page.getByRole('textbox', { name: /Test Type/i })
    await expect(testTypeInput).toBeVisible()
    await expect(testTypeInput).toHaveValue('17-Panel Instant')
    await expect(page.getByLabel(/^PCP$/i)).toBeVisible()
    await expect(page.getByLabel(/6-MAM/i)).toHaveCount(0)

    await page.getByLabel(/^PCP$/i).check()
    await expect(page.getByLabel(/^PCP$/i)).toBeChecked()

    await page.getByLabel(/Fentanyl/i).check()
    await triggerNextValidation(page)
    await expect(page.getByText('Must select an option')).toBeVisible()

    await page.getByRole('radio', { name: /Request Confirmation Testing/i }).check()
    await page.getByRole('button', { name: /Clear/i }).click()
    await triggerNextValidation(page)
    await expect(page.getByText('Please select at least one substance for confirmation testing')).toBeVisible()

    await page.getByRole('radio', { name: /Accept Results/i }).check()
    const nextButton = page.getByTestId('wizard-next-button')
    if (await nextButton.isEnabled().catch(() => false)) {
      await nextButton.click()
    }

    await clickBack(page)
    await expect(page.getByText('Verify Test Data')).toBeVisible()
    await clickBack(page)
    await expect(page.getByText('Verify Medications')).toBeVisible()
    await clickNext(page)
    await expect(page.getByText('Verify Test Data')).toBeVisible()
    await expect(page.getByLabel(/^PCP$/i)).toBeChecked()
    await expect(page.getByLabel(/Fentanyl/i)).toBeChecked()
  })

  test('returns to report upload after a browser refresh', async ({ page }) => {
    const env = getE2EEnv()

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Extract Data/i],
    })
    await clickNext(page)

    const selectedClientHeading = page.getByRole('heading', { name: /Selected Client/i })
    if (!(await selectedClientHeading.isVisible().catch(() => false))) {
      await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)
    }

    await clickNext(page)
    await clickNext(page)
    await expect(page.getByText('Verify Test Data')).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /Upload Instant Drug Test Report/i })).toBeVisible({
      timeout: 30_000,
    })
    expect(new URL(page.url()).searchParams.get('step')).toBeNull()
    await clickNext(page)
    await expect(page.getByText('Please upload a PDF file')).toBeVisible()
  })

  test('restores the instant report after the client-registration detour', async ({ page }) => {
    const env = getE2EEnv()

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Extract Data/i],
    })
    await clickNext(page)

    await expect.poll(() => page.evaluate(() => localStorage.getItem('instant-test-uploaded-file') !== null)).toBe(true)

    await page.getByRole('link', { name: /Register New Client/i }).click()
    await expect(page.getByRole('heading', { name: /Personal Information/i })).toBeVisible()

    await page.goto(`/admin/drug-test-upload?workflow=instant-test&step=client&clientId=${fixtures.clients.instant.id}`)

    await expect(page.getByRole('heading', { name: /Selected Client/i })).toBeVisible({ timeout: 30_000 })
    await clickNext(page)
    await expect(page.getByText('Verify Medications')).toBeVisible()
    await clickNext(page)
    await expect(page.getByText('Verify Test Data')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /Test Type/i })).toHaveValue('17-Panel Instant')
  })

  test('submits instant workflow, creates test, and verifies screened-stage emails with attachment', async ({
    page,
  }) => {
    const env = getE2EEnv()
    const testStart = new Date()

    await goToEmailsStepFromInstant(page, env.pdfInstantPath, fixtures.clients.instant.fullName)

    await page.getByRole('button', { name: /^Create Drug Test$/i }).click()

    await expect(page.getByRole('heading', { name: 'Drug Test Created Successfully!' })).toBeVisible({
      timeout: 30_000,
    })

    const testId = await extractTestIdFromSuccess(page)
    fixtures.created.drugTestIds.push(testId)

    const testRecord = await assertNotificationSent({ testId, stage: 'screened' })

    expect(testRecord.screeningStatus).toBe('complete')

    const expectedSubject = subjectForClient('Drug Test Results', fixtures.clients.instant)

    if (env.enableMailpitAssertions) {
      await findMailpitMessages({
        apiBase: env.mailpitApiBase,
        createdAfter: testStart,
        to: fixtures.clients.instant.email,
        subject: expectedSubject,
        requireAttachment: 'some',
        timeoutMs: 45_000,
      })

      await findMailpitMessages({
        apiBase: env.mailpitApiBase,
        createdAfter: testStart,
        to: fixtures.clients.instant.referralRecipients[0],
        subject: expectedSubject,
        requireAttachment: 'some',
        timeoutMs: 45_000,
      })
    }
  })
})

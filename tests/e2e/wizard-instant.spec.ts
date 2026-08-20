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
    const env = getE2EEnv({ pdfs: ['instant'] })
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

  test('reveals discontinued medication errors and animates consecutive additions on portrait iPad', async ({
    page,
  }) => {
    const env = getE2EEnv({ pdfs: ['instant'] })

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Extract Data/i],
    })
    await expect(page.getByText(/Parsed with high confidence \(100%\)/i)).toBeVisible()
    await expect(page.getByText('All Negative', { exact: true })).toBeVisible()
    await expect(page.getByText(/Results Incomplete/i)).toHaveCount(0)
    await clickNext(page)

    await expect(page.getByRole('heading', { name: /Choose a Client/i })).toBeVisible({ timeout: 30_000 })
    await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)
    await clickNext(page)
    await expect(page.getByText('Verify Medications')).toBeVisible()
    await page.setViewportSize({ width: 768, height: 1024 })

    const medicationCard = page.getByRole('group', { name: 'Medication: Suboxone' })
    const medicationTrigger = medicationCard.getByRole('button', { name: /Suboxone/i })
    await medicationTrigger.click()

    const medicationStatus = medicationCard.getByRole('combobox', { name: 'Status *' })
    const endDate = medicationCard.getByLabel('End Date')

    await expect(endDate).toBeHidden()
    await medicationStatus.click()
    await page.getByRole('option', { name: 'Discontinued', exact: true }).click()
    await expect(endDate).toBeVisible()
    await expect(endDate).toContainText('Select date')

    await medicationTrigger.click()
    await expect(endDate).toBeHidden()
    await triggerNextValidation(page)

    await expect(endDate).toBeVisible()
    await expect(endDate).toHaveAttribute('aria-invalid', 'true')
    await expect(endDate).toBeFocused()
    await expect(page.getByText('End date is required for discontinued medications')).toBeVisible()
    await expect
      .poll(() =>
        endDate.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight
        }),
      )
      .toBe(true)

    await endDate.click()
    await page.locator('[data-slot="calendar"] button[data-day]').filter({ visible: true }).first().click()
    await expect(endDate).not.toContainText('Select date')
    await medicationStatus.click()
    await page.getByRole('option', { name: 'Active', exact: true }).click()
    await expect(endDate).toBeHidden()
    await expect(page.getByText('End date is required for discontinued medications')).toHaveCount(0)

    await medicationStatus.click()
    await page.getByRole('option', { name: 'Discontinued', exact: true }).click()
    await expect(endDate).toContainText('Select date')
    await medicationStatus.click()
    await page.getByRole('option', { name: 'Active', exact: true }).click()
    await expect(endDate).toBeHidden()

    const pageErrors: Error[] = []
    page.on('pageerror', (error) => pageErrors.push(error))

    const addMedicationButton = page.getByRole('button', { name: 'Add Medication' })
    const newMedicationCards = page.getByRole('group', { name: 'Medication: New Medication', exact: true })
    const newMedicationNames = newMedicationCards.getByPlaceholder('e.g., Ibuprofen')

    await addMedicationButton.click()
    await expect(newMedicationCards).toHaveCount(1)
    await addMedicationButton.click()
    await expect(newMedicationCards).toHaveCount(2)

    await triggerNextValidation(page)
    await expect(newMedicationNames.first()).toHaveAttribute('aria-invalid', 'true')
    await expect(newMedicationNames.first()).toBeFocused()
    await expect(page.getByText('Medication name is required')).toHaveCount(2)
    expect(pageErrors.map((error) => error.message)).toEqual([])
  })

  test('validates upload and confirmation-decision branches, with back-forward navigation', async ({ page }) => {
    const env = getE2EEnv({ pdfs: ['instant'] })

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
    await expect(page.getByText('$30/substance.', { exact: false })).toBeVisible()
    await expect(page.getByText('$45/substance.', { exact: false })).toHaveCount(0)
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
    const env = getE2EEnv({ pdfs: ['instant'] })

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
    await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBeNull()
    await clickNext(page)
    await expect(page.getByText('Please upload a PDF file')).toBeVisible()
  })

  test('restores the instant report after the client-registration detour', async ({ page }) => {
    const env = getE2EEnv({ pdfs: ['instant'] })

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
    const env = getE2EEnv({ pdfs: ['instant'] })
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

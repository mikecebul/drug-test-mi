import { expectValidationError, expectWizardStep } from './helpers/wizard'
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
  continueFromInstantClient,
  extractTestIdFromSuccess,
  goToEmailsStepFromInstant,
  selectClientFromSearchDialog,
  selectWorkflow,
  selectResultDecision,
  triggerNextValidation,
  uploadSinglePdf,
  waitForExtractStepReady,
} from './helpers/wizard'

let fixtures: FixtureContext

function subjectForClient(prefix: string, person: FixtureContext['clients']['instant']) {
  return `${prefix} - ${person.firstName} ${person.lastName}`
}

test.describe('Wizard Instant Workflow', () => {
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
    await selectWorkflow(page, 'Screen Instant Test')
  })

  test(
    'reveals discontinued medication errors and animates consecutive additions on portrait iPad',
    { tag: ['@pdf-browser', '@critical'] },
    async ({ page }) => {
      const env = getE2EEnv({ pdfs: ['instant'] })

      await uploadSinglePdf(page, env.pdfInstantPath)
      await clickNext(page)
      await waitForExtractStepReady(page)
      await page.getByRole('button', { name: 'Report details', exact: true }).click()
      await clickNext(page)

      await expectWizardStep(page, 'client')
      await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)
      await continueFromInstantClient(page)
      await expectWizardStep(page, 'medications')
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
      await expectValidationError(page, endDate)
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
      await expect(medicationCard.getByRole('alert')).toHaveCount(0)

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
      await expect(newMedicationNames.last()).toHaveAttribute('aria-invalid', 'true')
      await expect(newMedicationNames.first()).toBeFocused()
      await expectValidationError(page)
      expect(pageErrors.map((error) => error.message)).toEqual([])
    },
  )

  test('requires a report before advancing', async ({ page }) => {
    await clickNext(page)
    await expectValidationError(page)
    await expectWizardStep(page, 'upload')
  })

  test(
    'validates confirmation decisions and retains edited results across Back',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      const env = getE2EEnv({ pdfs: ['instant'] })

      await uploadSinglePdf(page, env.pdfInstantPath)
      await clickNext(page)
      await waitForExtractStepReady(page)
      await clickNext(page)

      await expectWizardStep(page, 'client')
      await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)

      await continueFromInstantClient(page)
      await clickNext(page)

      await expectWizardStep(page, 'verifyData')

      await page.getByRole('button', { name: 'Edit test details', exact: true }).click()
      const testTypeInput = page.getByRole('textbox', { name: /Test Type/i })
      await expect(testTypeInput).toBeVisible()
      await expect(testTypeInput).toHaveValue('17-Panel Instant')
      await expect(page.getByLabel(/^PCP$/i)).toBeVisible()
      await expect(page.getByLabel(/6-MAM/i)).toHaveCount(0)

      await page.getByLabel(/^PCP$/i).check()
      await expect(page.getByLabel(/^PCP$/i)).toBeChecked()

      await page.getByLabel(/Fentanyl/i).check()
      await expect(page.locator('#accept')).toBeVisible()
      await triggerNextValidation(page)
      await expectValidationError(page)
      await expectWizardStep(page, 'verifyData')

      await selectResultDecision(page, 'request-confirmation')
      await page.getByRole('button', { name: 'Change', exact: true }).click()
      await page.getByRole('button', { name: /Clear/i }).click()
      await triggerNextValidation(page)
      await expectValidationError(page)
      await expectWizardStep(page, 'verifyData')

      await selectResultDecision(page, 'accept')
      await clickNext(page)
      await expectWizardStep(page, 'reviewEmails')

      await clickBack(page)
      await expectWizardStep(page, 'verifyData')
      await clickBack(page)
      await expectWizardStep(page, 'medications')
      await clickNext(page)
      await expectWizardStep(page, 'verifyData')
      await page.getByRole('button', { name: 'Edit test details', exact: true }).click()
      await expect(page.getByLabel(/^PCP$/i)).toBeChecked()
      await expect(page.getByLabel(/Fentanyl/i)).toBeChecked()
      expect(pageErrors).toEqual([])
    },
  )

  test('returns to report upload after a browser refresh', async ({ page }) => {
    const env = getE2EEnv({ pdfs: ['instant'] })

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page)
    await clickNext(page)

    await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)

    await continueFromInstantClient(page)
    await clickNext(page)
    await expectWizardStep(page, 'verifyData')

    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.locator('[data-slot="file-upload"] input[type="file"]')).toBeAttached()
    await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBeNull()
    await clickNext(page)
    await expectValidationError(page)
  })

  test('restores the instant report after the client-registration detour', async ({ page }) => {
    const env = getE2EEnv({ pdfs: ['instant'] })

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page)
    await clickNext(page)

    await page.getByRole('link', { name: /Register New Client/i }).click()
    await expectWizardStep(page, 'personalInfo')

    await page.goto(`/admin/drug-test-upload?workflow=instant-test&step=client&clientId=${fixtures.clients.instant.id}`)

    await expectWizardStep(page, 'client')
    await continueFromInstantClient(page)
    await expectWizardStep(page, 'medications')
    await clickNext(page)
    await expectWizardStep(page, 'verifyData')
    await page.getByRole('button', { name: 'Edit test details', exact: true }).click()
    await expect(page.getByRole('textbox', { name: /Test Type/i })).toHaveValue('17-Panel Instant')
  })

  test(
    'submits instant workflow, creates test, and verifies screened-stage emails with attachment',
    { tag: '@smoke' },
    async ({ page }) => {
      const env = getE2EEnv({ pdfs: ['instant'] })
      const testStart = new Date()

      await goToEmailsStepFromInstant(page, env.pdfInstantPath, fixtures.clients.instant.fullName)

      await page.getByTestId('wizard-next-button').click()

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
    },
  )
})

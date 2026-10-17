import { expect, test, type Page } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { assertNotificationSent } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import { ensureMailpitReachable, findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import {
  editScreeningReport,
  applyScreeningReportEdits,
  clickBack,
  clickNext,
  expectValidationError,
  expectWizardStep,
  expectLabReportSavedAndReset,
  goToLabScreenData,
  selectWorkflow,
  selectResultDecision,
} from './helpers/wizard'

let fixtures: FixtureContext

async function openScreenData(page: Page) {
  await goToLabScreenData(
    page,
    getE2EEnv({ pdfs: ['labScreen'] }).pdfLabScreenPath,
    fixtures.tests.labScreenCollectedTestId,
  )
  const editor = await editScreeningReport(page)
  await expect(editor.getByRole('checkbox', { name: /^Buprenorphine\b/i })).toBeChecked()
  await applyScreeningReportEdits(page)
}

test.describe('Wizard Lab Screen Workflow', () => {
  test.beforeAll(async () => {
    fixtures = await seedFixtures()
    const env = getE2EEnv({ pdfs: ['labScreen'] })
    if (env.enableMailpitAssertions) await ensureMailpitReachable(env.mailpitApiBase)
  })
  test.afterAll(async () => cleanupFixtures(fixtures))
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await selectWorkflow(page, 'Enter Lab Screen Data')
  })

  test(
    'requires a report and a valid confirmation decision, retaining edits across Back',
    { tag: '@critical' },
    async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await expect(page.getByTestId('wizard-next-button')).toBeEnabled()
      await clickNext(page)
      await expectWizardStep(page, 'upload')
      await expectWizardStep(page, 'upload')
      await openScreenData(page)

      const editor = await editScreeningReport(page)
      const fentanyl = editor.getByRole('checkbox', { name: /^Fentanyl\b/i })
      await fentanyl.check()
      await applyScreeningReportEdits(page)
      await expect(page.locator('#accept')).toBeVisible()
      await clickNext(page)
      await expectWizardStep(page, 'results')
      await expect(page.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true')

      await selectResultDecision(page, 'request-confirmation')
      await page
        .getByTestId('confirmation-request-options')
        .getByRole('checkbox', { name: /^Fentanyl\b/i })
        .uncheck()
      await clickNext(page)
      await expectValidationError(page)
      await expectWizardStep(page, 'results')

      await selectResultDecision(page, 'accept')
      await clickNext(page)
      await expectWizardStep(page, 'review')
      await clickBack(page)
      await expectWizardStep(page, 'results')
      await expect(page.locator('#accept')).toBeChecked()
      await editScreeningReport(page)
      await expect(fentanyl).toBeChecked()
      await applyScreeningReportEdits(page)
      await clickNext(page)
      await expectWizardStep(page, 'review')
      expect(errors).toEqual([])
    },
  )

  test('screening drawer applies corrections and restores the draft on cancel', async ({ page }) => {
    await page.setViewportSize({ width: 779, height: 1080 })
    await openScreenData(page)
    await expect(page.getByLabel('Screening result date', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit test details', exact: true })).toHaveCount(0)
    const editor = await editScreeningReport(page)
    const fentanyl = editor.getByRole('checkbox', { name: /^Fentanyl\b/i })
    await fentanyl.check()
    await page.screenshot({ path: test.info().outputPath('screening-results-editor.png') })
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(editor).toBeHidden()
    await expect(page.getByTestId('screening-result-fentanyl')).toHaveCount(0)
    await editScreeningReport(page)
    await fentanyl.check()
    await applyScreeningReportEdits(page)
    await expect(page.getByTestId('screening-result-fentanyl')).toBeVisible()
    const expected = await page.getByTestId('screening-result-buprenorphine').locator('span').last().boundingBox()
    const unexpected = await page.getByTestId('screening-result-fentanyl').locator('span').last().boundingBox()
    expect(Math.abs(expected!.x - unexpected!.x)).toBeLessThanOrEqual(1)
    // Card descriptions, not just the tiny radio control, select the decision.
    await page
      .getByTestId('confirmation-decision-pending-decision')
      .getByText('Track for 30 days', { exact: false })
      .click()
    await expect(page.locator('#pending-decision')).toBeChecked()
    await page.getByTestId('confirmation-decision-accept').click({ position: { x: 6, y: 6 } })
    await expect(page.locator('#accept')).toBeChecked()
    await clickNext(page)
    await expectWizardStep(page, 'review')
  })

  test(
    'saves screening results on the selected collection and sends report attachments',
    { tag: '@smoke' },
    async ({ page }) => {
      const env = getE2EEnv({ pdfs: ['labScreen'] })
      await openScreenData(page)
      await clickNext(page)
      await expectWizardStep(page, 'review')
      const started = new Date()
      await page.getByTestId('wizard-next-button').click()
      await expectLabReportSavedAndReset(page)
      const testId = fixtures.tests.labScreenCollectedTestId
      const record = await assertNotificationSent({ testId, stage: 'screened' })
      expect(record.screeningStatus).toBe('complete')
      expect(record.detectedSubstances).toEqual(['buprenorphine'])
      expect(record.testDocument).toBeTruthy()
      if (env.enableMailpitAssertions) {
        for (const to of [fixtures.clients.labScreen.email, ...fixtures.clients.labScreen.referralRecipients]) {
          await findMailpitMessages({
            apiBase: env.mailpitApiBase,
            createdAfter: started,
            to,
            subject: /Drug Test Results/i,
            requireAttachment: 'some',
            timeoutMs: 45_000,
          })
        }
      }
    },
  )
})

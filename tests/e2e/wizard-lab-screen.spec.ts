import { expect, test, type Page } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { assertNotificationSent } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import { ensureMailpitReachable, findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import {
  clickBack,
  clickNext,
  expectValidationError,
  expectWizardStep,
  extractTestIdFromSuccess,
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
  await expect(page.getByRole('checkbox', { name: /^Buprenorphine\b/i })).toBeChecked()
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
      await clickNext(page)
      await expectValidationError(page)
      await expectWizardStep(page, 'upload')
      await openScreenData(page)

      const fentanyl = page.getByRole('checkbox', { name: /^Fentanyl\b/i })
      await fentanyl.check()
      await expect(page.locator('#accept')).toBeVisible()
      await clickNext(page)
      await expectWizardStep(page, 'labScreenData')
      await expect(page.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true')

      await selectResultDecision(page, 'request-confirmation')
      await page.getByRole('button', { name: /Clear/i }).click()
      await clickNext(page)
      await expectValidationError(page)
      await expectWizardStep(page, 'labScreenData')

      await selectResultDecision(page, 'accept')
      await clickNext(page)
      await expectWizardStep(page, 'confirm')
      await clickBack(page)
      await expectWizardStep(page, 'labScreenData')
      await expect(page.locator('#accept')).toBeChecked()
      await expect(fentanyl).toBeChecked()
      await clickNext(page)
      await expectWizardStep(page, 'confirm')
      await clickNext(page)
      await expectWizardStep(page, 'emails')
      expect(errors).toEqual([])
    },
  )

  test(
    'saves screening results on the selected collection and sends report attachments',
    { tag: '@smoke' },
    async ({ page }) => {
      const env = getE2EEnv({ pdfs: ['labScreen'] })
      await openScreenData(page)
      await clickNext(page)
      await expectWizardStep(page, 'confirm')
      await clickNext(page)
      await expectWizardStep(page, 'emails')
      const started = new Date()
      await page.getByTestId('wizard-next-button').click()
      const testId = await extractTestIdFromSuccess(page)
      expect(testId).toBe(fixtures.tests.labScreenCollectedTestId)
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

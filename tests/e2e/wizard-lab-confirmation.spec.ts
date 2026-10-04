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
  extractTestIdFromSuccess,
  openWizard,
  selectWorkflow,
  triggerNextValidation,
  expectWizardStep,
  expectValidationError,
  uploadSinglePdf,
  waitForExtractStepReady,
} from './helpers/wizard'

let fixtures: FixtureContext

async function ensureMatchSelected(page: Page) {
  const candidate = page.getByTestId(`pending-test-${fixtures.tests.labConfirmPendingTestId}`)
  await candidate.click()
  await expect(candidate).toHaveAttribute('aria-pressed', 'true')
}

test.describe('Wizard Lab Confirmation Workflow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    fixtures = await seedFixtures()
    const env = getE2EEnv({ pdfs: ['labScreen', 'labConfirm'] })
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

  test('validates upload/match/confirmation-result-required branches with back-forward navigation', async ({
    page,
  }) => {
    const env = getE2EEnv({ pdfs: ['labScreen'] })

    await clickNext(page)
    await expectValidationError(page)
    await expectWizardStep(page, 'upload')

    // Use the lab-screen PDF to force empty confirmation results in this workflow.
    await uploadSinglePdf(page, env.pdfLabScreenPath)
    await clickNext(page)
    await waitForExtractStepReady(page)
    await clickNext(page)

    await ensureMatchSelected(page)
    await clickNext(page)

    await expectWizardStep(page, 'labConfirmationData')
    await triggerNextValidation(page)
    await expectValidationError(page)
    await expectWizardStep(page, 'labConfirmationData')

    await clickBack(page)
    await expectWizardStep(page, 'matchCollection')
    await clickNext(page)
    await expectWizardStep(page, 'labConfirmationData')
  })

  test(
    'adds a confirmation report before payment and preserves the outstanding balance',
    { tag: '@smoke' },
    async ({ page }) => {
      const env = getE2EEnv({ pdfs: ['labConfirm'] })

      await uploadSinglePdf(page, env.pdfLabConfirmPath)
      await clickNext(page)
      await waitForExtractStepReady(page)
      await clickNext(page)
      await ensureMatchSelected(page)
      await clickNext(page)

      await expectWizardStep(page, 'labConfirmationData')
      await clickNext(page)
      await clickNext(page)

      await expectWizardStep(page, 'emails')

      const testStart = new Date()
      await page.getByTestId('wizard-next-button').click()

      const testId = await extractTestIdFromSuccess(page)
      expect(testId).toBe(fixtures.tests.labConfirmPendingTestId)

      const testRecord = await assertNotificationSent({ testId, stage: 'complete' })

      expect(testRecord.screeningStatus).toBe('complete')

      const refreshed = await getDrugTestById(testId)
      expect(refreshed.confirmationResults).toEqual([
        expect.objectContaining({ substance: 'fentanyl', result: 'confirmed-negative' }),
      ])
      expect(refreshed.confirmationDocument).toBeTruthy()
      expect(refreshed.payment).toMatchObject({
        status: 'unpaid',
        amountDue: 45,
        amountPaid: 0,
        balanceDue: 45,
        confirmationFeeDue: 45,
        confirmationPaymentBypassed: false,
      })

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
    },
  )
})

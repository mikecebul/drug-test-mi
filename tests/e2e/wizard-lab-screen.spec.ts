import { expect, test, type Page } from '@playwright/test'
import { TZDate } from '@date-fns/tz'
import { getPayloadClient } from './helpers/payload'
import { APP_TIMEZONE, formatDateOnlyISO } from '../../src/lib/date-utils'
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
      await expect(page.getByTestId('wizard-next-button')).toBeEnabled()
      await clickNext(page)
      await expectWizardStep(page, 'upload')
      await expectWizardStep(page, 'upload')
      await openScreenData(page)

      const fentanyl = page.getByRole('checkbox', { name: /^Fentanyl\b/i })
      await fentanyl.check()
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
      await page.getByRole('button', { name: 'Edit test details', exact: true }).click()
      await expect(fentanyl).toBeChecked()
      await clickNext(page)
      await expectWizardStep(page, 'review')
      expect(errors).toEqual([])
    },
  )

  test('Next reveals an invalid date even when test edits are collapsed', async ({ page }) => {
    const payload = await getPayloadClient()
    const collection = await payload.create({
      collection: 'drug-tests',
      overrideAccess: true,
      data: {
        relatedClient: fixtures.clients.labScreen.id,
        testType: '11-panel-lab',
        collectionDate: '2026-01-08T12:00:00Z',
        screeningStatus: 'collected',
        payment: { status: 'unpaid', amountDue: 0, amountPaid: 0, balanceDue: 0 },
      },
    })
    fixtures.created.drugTestIds.push(collection.id)
    await goToLabScreenData(page, getE2EEnv({ pdfs: ['labScreen'] }).pdfLabScreenPath, collection.id)
    const dateInput = page.getByLabel('Screening result date', { exact: true })
    await dateInput.fill('')
    const details = page.getByRole('button', { name: 'Edit test details', exact: true })
    await details.click()
    await expect(dateInput).toBeHidden()
    await clickNext(page)
    await expectWizardStep(page, 'results')
    await expect(dateInput).toBeVisible()
    await expect(dateInput).toHaveAttribute('aria-invalid', 'true')
    await expect(dateInput).toBeFocused()
    await dateInput.fill(formatDateOnlyISO(new TZDate(new Date(), APP_TIMEZONE)))
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

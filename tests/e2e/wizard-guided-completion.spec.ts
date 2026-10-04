import { expect, test } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
import { getPayloadClient } from './helpers/payload'
import { getE2EEnv } from './helpers/env'
import { assertNotificationSent } from './helpers/db-assert'
import { findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import {
  clickNext,
  expectWizardStep,
  extractTestIdFromSuccess,
  uploadSinglePdf,
  waitForExtractStepReady,
} from './helpers/wizard'

let fixtures: FixtureContext
test.beforeEach(async ({ page }) => {
  fixtures = await seedFixtures()
  await loginAdmin(page, fixtures.admin)
})
test.afterEach(async () => cleanupFixtures(fixtures))

for (const kind of ['instant', 'lab'] as const) {
  test(
    `completes a guided ${kind} collection and links the saved result and payment to its booking`,
    { tag: '@smoke' },
    async ({ page }) => {
      const payload = await getPayloadClient()
      const client = kind === 'instant' ? fixtures.clients.instant : fixtures.clients.collectLab
      const amount = kind === 'instant' ? 35 : 40
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const booking = await payload.create({
        collection: 'bookings',
        overrideAccess: true,
        data: {
          title: `E2E completion ${fixtures.runId}`,
          type: 'e2e-guided-schedule',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 30 * 60_000).toISOString(),
          status: 'confirmed',
          attendeeName: client.fullName,
          attendeeEmail: client.email,
          organizer: { name: 'E2E Scheduler', email: 'scheduler@example.test', timeZone: 'America/New_York' },
          relatedClient: client.id,
          scheduledTestType: kind === 'instant' ? '17-panel-instant' : '11-panel-lab',
          payment: {
            amountDue: amount,
            amountPaid: kind === 'instant' ? amount : 0,
            status: kind === 'instant' ? 'paid' : 'unpaid',
            method: kind === 'instant' ? 'pre-paid' : 'not-paid',
          },
          sampleCollection: { status: 'pending' },
          calcomBookingId: `e2e-${fixtures.runId}-${kind}`,
          createdViaWebhook: false,
        },
      })
      fixtures.created.bookingIds = [booking.id]
      await page.goto(`/admin/drug-test-upload?workflow=guided&step=review&bookingId=${booking.id}`)
      await expect(page.locator('[data-wizard-ready="true"]')).toBeVisible()
      await clickNext(page)
      await expectWizardStep(page, 'payment')
      if (kind === 'lab') {
        await expect(page.getByTestId('client-amount-due')).toHaveText('$40.00')
        await clickNext(page)
        const dialog = page.getByRole('alertdialog')
        await expect(dialog).toBeVisible()
        await dialog.getByRole('button', { name: /^Continue$/i }).click()
        await expectWizardStep(page, 'toxaccess')
        const confirmed = page.locator('#lab-report-created')
        await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
        await confirmed.check()
        await expect(confirmed).toBeChecked()
        await clickNext(page)
      } else {
        await clickNext(page)
        await expectWizardStep(page, 'upload')
        await uploadSinglePdf(page, getE2EEnv({ pdfs: ['instant'] }).pdfInstantPath)
        await clickNext(page)
        await waitForExtractStepReady(page)
        await page.getByTestId('report-client-confirmation').check()
        await clickNext(page)
      }
      await expectWizardStep(page, 'medications')
      await clickNext(page)
      await expectWizardStep(page, kind === 'instant' ? 'verifyData' : 'collection')
      await clickNext(page)
      await expectWizardStep(page, 'reviewEmails')
      if (kind === 'lab') await page.getByLabel(/Send referral notifications/i).check()
      const started = new Date()
      await page.getByTestId('wizard-next-button').click()
      const testId = await extractTestIdFromSuccess(page)
      fixtures.created.drugTestIds.push(testId)
      const record = await assertNotificationSent({ testId, stage: kind === 'instant' ? 'screened' : 'collected' })
      expect(record.relatedClient).toBe(client.id)
      expect(record.testType).toBe(kind === 'instant' ? '17-panel-instant' : '11-panel-lab')
      expect(record.payment).toMatchObject({
        amountDue: amount,
        amountPaid: kind === 'instant' ? amount : 0,
        balanceDue: kind === 'instant' ? 0 : amount,
        status: kind === 'instant' ? 'paid' : 'unpaid',
      })
      if (kind === 'instant') {
        expect(record.detectedSubstances).toEqual([])
        expect(record.testDocument).toBeTruthy()
      }
      const saved = await payload.findByID({ collection: 'bookings', id: booking.id, depth: 0, overrideAccess: true })
      expect(saved.sampleCollection).toMatchObject({ status: 'collected', drugTest: testId })
      const env = getE2EEnv({ requirePdfs: false })
      if (env.enableMailpitAssertions) {
        await findMailpitMessages({
          apiBase: env.mailpitApiBase,
          createdAfter: started,
          to: client.email,
          subject: /Drug Test/i,
          requireAttachment: kind === 'instant' ? 'some' : 'none',
        })
      }
      expect(errors).toEqual([])
    },
  )
}

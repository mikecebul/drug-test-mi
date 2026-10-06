import { expect, test } from '@playwright/test'
import { loginAdmin } from './helpers/auth'
import { cleanupFixtures } from './helpers/cleanup'
import { assertNotificationSent } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import {
  clickNext,
  expectWizardStep,
  extractTestIdFromSuccess,
  goToInstantResults,
  goToLabScreenData,
  selectWorkflow,
  selectResultDecision,
} from './helpers/wizard'

let fixtures: FixtureContext
test.beforeEach(async ({ page }) => {
  fixtures = await seedFixtures()
  await loginAdmin(page, fixtures.admin)
})
test.afterEach(async () => cleanupFixtures(fixtures))

for (const workflow of ['instant', 'lab'] as const) {
  for (const decision of ['accept', 'request-confirmation', 'pending-decision'] as const) {
    test(`saves an unexpected ${workflow} positive with the ${decision} decision`, async ({ page }) => {
      const env = getE2EEnv({ pdfs: [workflow === 'instant' ? 'instant' : 'labScreen'] })
      const client = workflow === 'instant' ? fixtures.clients.instant : fixtures.clients.labScreen
      await selectWorkflow(page, workflow === 'instant' ? 'Screen Instant Test' : 'Enter Lab Screen Data')
      if (workflow === 'instant') {
        await goToInstantResults(page, env.pdfInstantPath, client.fullName)
        await page.getByRole('button', { name: /Edit test details/i }).click()
      } else {
        await goToLabScreenData(page, env.pdfLabScreenPath, fixtures.tests.labScreenCollectedTestId)
      }

      await page.getByRole('checkbox', { name: /^Fentanyl\b/i }).check()
      await selectResultDecision(page, decision)
      await clickNext(page)
      await expectWizardStep(page, workflow === 'instant' ? 'reviewEmails' : 'review')
      const started = new Date()
      await page.getByTestId('wizard-next-button').click()
      const testId = await extractTestIdFromSuccess(page)
      if (workflow === 'instant') fixtures.created.drugTestIds.push(testId)
      else expect(testId).toBe(fixtures.tests.labScreenCollectedTestId)

      const record = await assertNotificationSent({ testId, stage: 'screened' })
      expect(record.relatedClient).toBe(client.id)
      expect(record.detectedSubstances.toSorted()).toEqual(
        workflow === 'instant' ? ['fentanyl'] : ['buprenorphine', 'fentanyl'],
      )
      expect(record.unexpectedPositives).toEqual(['fentanyl'])
      expect(record.confirmationDecision).toBe(decision)
      expect(record.isComplete).toBe(decision === 'accept')
      if (decision === 'request-confirmation') expect(record.confirmationSubstances).toEqual(['fentanyl'])
      expect(record.testDocument).toBeTruthy()
      if (env.enableMailpitAssertions) {
        await findMailpitMessages({
          apiBase: env.mailpitApiBase,
          createdAfter: started,
          to: client.email,
          subject: /Drug Test/i,
          requireAttachment: 'some',
        })
      }
    })
  }
}
